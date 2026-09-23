"""
=============================================================================
AQUAGHOST-SONAR: Edge AI & Acoustic Physics Pipeline for Marine Debris Detection
Module 1: Acoustic Physics Preprocessing (Node 2)
Target Platform: NVIDIA Jetson Orin / Xavier / Nano (Edge Autonomous Sonar)
Author: AQUAGHOST-SONAR Core Engineering Team (Smart India Hackathon)
=============================================================================
"""

import numpy as np
import cv2
from typing import Tuple, Optional, Union, Dict, Any


class SonarPreprocessor:
    """
    Deterministic Acoustic Physics Preprocessor for Side-Scan Sonar (SSS) imagery.
    
    Implements:
      1. Time-Varying Gain (TVG) compensation for two-way acoustic transmission loss:
         TL(R_s) = 40 * log10(R_s) + 2 * alpha * R_s * 10^-3  [dB]
      2. Logarithmic Homomorphic Speckle Filtering to suppress Rayleigh multiplicative
         speckle noise without blurring high-frequency net filament edges.
      3. Slant-Range to Ground-Range (SRGR) Geometric Unwarping using the Pythagorean
         theorem: R_g = sqrt(R_s^2 - H^2), eliminating nadir blind zones and compression.
    """

    def __init__(
        self,
        sound_speed: float = 1500.0,
        frequency_khz: float = 450.0,
        absorption_alpha: Optional[float] = None,
        speckle_kernel_size: int = 5,
        speckle_sigma_color: float = 0.35,
        speckle_sigma_space: float = 3.0,
        min_slant_range_m: float = 1.0,
    ):
        """
        Initialize the SonarPreprocessor.

        Args:
            sound_speed: Velocity of acoustic wave in seawater (m/s), default 1500 m/s.
            frequency_khz: Sonar operating acoustic frequency in kHz (e.g. 450 kHz or 900 kHz).
            absorption_alpha: Seawater acoustic absorption coefficient in dB/km.
                              If None, approximated via simplified Francois-Garrison relation.
            speckle_kernel_size: Window size for homomorphic bilateral speckle filter (odd int).
            speckle_sigma_color: Photometric variance in log-reflectance domain.
            speckle_sigma_space: Geometric spatial variance in pixels.
            min_slant_range_m: Cutoff minimum slant range to prevent log(0) singularities.
        """
        self.sound_speed = float(sound_speed)
        self.frequency_khz = float(frequency_khz)
        self.speckle_kernel_size = speckle_kernel_size if speckle_kernel_size % 2 == 1 else speckle_kernel_size + 1
        self.speckle_sigma_color = float(speckle_sigma_color)
        self.speckle_sigma_space = float(speckle_sigma_space)
        self.min_slant_range_m = float(min_slant_range_m)

        # Estimate seawater absorption coefficient alpha (dB/km) if not manually provided
        if absorption_alpha is not None:
            self.alpha = float(absorption_alpha)
        else:
            # High-frequency ocean acoustic absorption approximation: alpha ~= 0.05 * f^1.4 dB/km
            # At 450 kHz, alpha ~ 80-120 dB/km; at 900 kHz, alpha ~ 250-320 dB/km.
            self.alpha = 0.045 * (self.frequency_khz ** 1.32)

    def apply_tvg(
        self,
        sonar_image: np.ndarray,
        max_slant_range_m: float,
        spreading_loss_factor: float = 35.0,
        is_port_starboard_split: bool = True,
    ) -> np.ndarray:
        """
        Apply Time-Varying Gain (TVG) compensation to neutralize spherical spreading
        and seawater acoustic absorption across the slant-range dimension.

        Formula:
            Gain_dB(r) = spreading_loss_factor * log10(R_s / R_min) + 2 * alpha * (R_s - R_min) * 10^-3
            Scale_linear(r) = 10 ^ (Gain_dB(r) / 20)

        Args:
            sonar_image: 2D array [pings, samples] or 3D [pings, samples, channels].
            max_slant_range_m: Maximum slant range reached at the edge swath in meters.
            spreading_loss_factor: Geometric spreading coefficient (typically 30-40 dB).
            is_port_starboard_split: If True, nadir is at the center column (port on left,
                                     starboard on right). If False, range increases from left to right.

        Returns:
            tvg_corrected: Float32 image array with range-uniform acoustic backscatter.
        """
        img_float = sonar_image.astype(np.float32)
        height, width = img_float.shape[:2]

        if is_port_starboard_split:
            mid = width // 2
            # Range profile for port (mirrored) and starboard
            r_indices_starboard = np.linspace(0, 1, width - mid, dtype=np.float32)
            r_indices_port = np.linspace(1, 0, mid, dtype=np.float32)
            r_normalized = np.concatenate([r_indices_port, r_indices_starboard])
        else:
            r_normalized = np.linspace(0, 1, width, dtype=np.float32)

        # Compute physical slant ranges R_s
        r_slant_m = np.maximum(r_normalized * max_slant_range_m, self.min_slant_range_m)

        # Transmission loss compensation in dB (two-way travel)
        geometric_loss_db = spreading_loss_factor * np.log10(r_slant_m / self.min_slant_range_m)
        absorption_loss_db = 2.0 * self.alpha * (r_slant_m - self.min_slant_range_m) * 1e-3
        total_tvg_gain_db = geometric_loss_db + absorption_loss_db

        # Convert dB gain to linear amplitude multiplier
        linear_gain_curve = np.power(10.0, total_tvg_gain_db / 20.0)

        # Broadcast across pings (height)
        gain_mask = np.tile(linear_gain_curve, (height, 1))

        if img_float.ndim == 3:
            gain_mask = np.expand_dims(gain_mask, axis=-1)

        tvg_corrected = img_float * gain_mask

        # Dynamic range stabilization (robust percentile normalization)
        p99 = np.percentile(tvg_corrected, 99.5)
        p1 = np.percentile(tvg_corrected, 0.5)
        if p99 > p1:
            tvg_corrected = np.clip((tvg_corrected - p1) / (p99 - p1), 0.0, 1.0)
        else:
            tvg_corrected = np.clip(tvg_corrected / (np.max(tvg_corrected) + 1e-6), 0.0, 1.0)

        return tvg_corrected

    def apply_logarithmic_speckle_filter(
        self,
        sonar_image: np.ndarray,
        epsilon: float = 1e-4,
    ) -> np.ndarray:
        """
        Homomorphic Logarithmic Speckle Filtering.
        
        Acoustic imaging exhibits multiplicative speckle noise: I = R * eta.
        In log space: ln(I + eps) = ln(R) + ln(eta), transforming multiplicative
        interference into additive Gaussian-like noise. An edge-preserving bilateral
        filter is applied, followed by exponential re-mapping.

        Args:
            sonar_image: Normalized float32 image array [0.0, 1.0].
            epsilon: Numerical floor to prevent log(0).

        Returns:
            filtered_image: Denoised float32 sonar image preserving net edges.
        """
        img_clamped = np.clip(sonar_image.astype(np.float32), 0.0, 1.0)

        # Step 1: Map to Homomorphic Log Domain
        log_domain = np.log(img_clamped + epsilon)

        # Normalize log domain to [0, 1] for OpenCV bilateral filtering
        log_min = np.min(log_domain)
        log_max = np.max(log_domain)
        log_norm = (log_domain - log_min) / (log_max - log_min + 1e-7)

        # Step 2: Edge-Preserving Bilateral Smoothing on additive noise
        if log_norm.ndim == 2:
            filtered_log = cv2.bilateralFilter(
                log_norm.astype(np.float32),
                d=self.speckle_kernel_size,
                sigmaColor=self.speckle_sigma_color,
                sigmaSpace=self.speckle_sigma_space,
            )
        else:
            filtered_log = np.empty_like(log_norm)
            for c in range(log_norm.shape[2]):
                filtered_log[:, :, c] = cv2.bilateralFilter(
                    log_norm[:, :, c].astype(np.float32),
                    d=self.speckle_kernel_size,
                    sigmaColor=self.speckle_sigma_color,
                    sigmaSpace=self.speckle_sigma_space,
                )

        # Step 3: Inverse Log Transform (Homomorphic restoration)
        log_restored = filtered_log * (log_max - log_min) + log_min
        linear_restored = np.exp(log_restored) - epsilon

        # Clip output to [0, 1]
        denoised = np.clip(linear_restored, 0.0, 1.0)
        return denoised

    def slant_to_ground_range(
        self,
        sonar_image: np.ndarray,
        altitude_h: float,
        max_slant_range_m: float,
        is_port_starboard_split: bool = True,
        output_samples_per_swath: Optional[int] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Slant-Range to Ground-Range (SRGR) Geometric Unwarping.

        Applies the Pythagorean relation:
            R_g = sqrt(R_s^2 - H^2)   for R_s >= H
        
        For every ground-range pixel R_g, we backward-sample from slant-range:
            R_s = sqrt(R_g^2 + H^2)
        
        Samples with R_s < H correspond to the nadir acoustic travel time in the
        water column and are geometrically mapped out.

        Args:
            sonar_image: 2D array [pings, samples] or 3D [pings, samples, channels].
            altitude_h: Sonar towfish or AUV altitude above seafloor in meters (H).
            max_slant_range_m: Maximum slant range reached in meters.
            is_port_starboard_split: Whether the image contains both port and starboard sides.
            output_samples_per_swath: Number of ground-range samples per side (optional).

        Returns:
            unwarped_image: Ground-projected seafloor backscatter array.
            metadata: Dict with physical resolution, ground swath width, and nadir blind samples.
        """
        H = max(float(altitude_h), 0.1)
        R_s_max = max(float(max_slant_range_m), H + 1.0)
        
        # Max physical ground range on seabed
        R_g_max = np.sqrt(max(R_s_max ** 2 - H ** 2, 1.0))

        height, width = sonar_image.shape[:2]

        def unwarp_single_swath(swath_img: np.ndarray, is_reversed_port: bool = False) -> np.ndarray:
            n_in = swath_img.shape[1]
            n_out = output_samples_per_swath or n_in

            # Uniform ground range grid from 0 to R_g_max
            r_g_grid = np.linspace(0.0, R_g_max, n_out, dtype=np.float32)

            # Corresponding slant range: R_s = sqrt(R_g^2 + H^2)
            r_s_needed = np.sqrt(r_g_grid ** 2 + H ** 2)

            # Map slant range to input pixel indices [0, n_in - 1]
            pixel_slant_coords = (r_s_needed / R_s_max) * (n_in - 1)

            # Build 2D sampling grid for cv2.remap
            # map_x: shape (height, n_out), map_y: shape (height, n_out)
            grid_y, grid_x = np.mgrid[0:height, 0:n_out].astype(np.float32)

            if is_reversed_port:
                # In port swath, nadir is at the right edge (n_in - 1) and range extends leftward
                actual_x_coords = (n_in - 1) - pixel_slant_coords
                map_x = np.tile(actual_x_coords, (height, 1)).astype(np.float32)
            else:
                # In starboard swath, nadir is at left edge (0) and range extends rightward
                map_x = np.tile(pixel_slant_coords, (height, 1)).astype(np.float32)

            map_y = grid_y

            # Remap using high-performance bilinear interpolation
            unwarped = cv2.remap(
                swath_img.astype(np.float32),
                map_x,
                map_y,
                interpolation=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_REFLECT101,
            )
            return unwarped

        if is_port_starboard_split:
            mid = width // 2
            port_raw = sonar_image[:, :mid]
            starboard_raw = sonar_image[:, mid:]

            port_unwarped = unwarp_single_swath(port_raw, is_reversed_port=True)
            starboard_unwarped = unwarp_single_swath(starboard_raw, is_reversed_port=False)

            unwarped_full = np.concatenate([port_unwarped, starboard_unwarped], axis=1)
            total_ground_swath_m = 2.0 * R_g_max
            ground_resolution_m_per_px = total_ground_swath_m / unwarped_full.shape[1]
        else:
            unwarped_full = unwarp_single_swath(sonar_image, is_reversed_port=False)
            total_ground_swath_m = R_g_max
            ground_resolution_m_per_px = total_ground_swath_m / unwarped_full.shape[1]

        metadata = {
            "altitude_h_m": H,
            "max_slant_range_m": R_s_max,
            "max_ground_range_m": float(R_g_max),
            "total_ground_swath_m": float(total_ground_swath_m),
            "ground_resolution_m_per_px": float(ground_resolution_m_per_px),
            "nadir_blind_slant_distance_m": float(H),
        }

        return unwarped_full, metadata

    def process_pipeline(
        self,
        raw_sonar_image: np.ndarray,
        altitude_h: float,
        max_slant_range_m: float,
        is_port_starboard_split: bool = True,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Complete end-to-end Module 1 execution:
        Raw -> TVG Compensation -> Logarithmic Speckle Filter -> Pythagorean Unwarping.

        Returns:
            processed_seafloor: Ready for GhostNetV2 backbone ingestion.
            metadata: Geometric and acoustic calibration metadata.
        """
        # Step 1: Time-Varying Gain
        tvg_corrected = self.apply_tvg(
            raw_sonar_image,
            max_slant_range_m=max_slant_range_m,
            is_port_starboard_split=is_port_starboard_split,
        )

        # Step 2: Homomorphic Log Speckle Reduction
        denoised = self.apply_logarithmic_speckle_filter(tvg_corrected)

        # Step 3: Slant-to-Ground Pythagorean Unwarping
        ground_corrected, metadata = self.slant_to_ground_range(
            denoised,
            altitude_h=altitude_h,
            max_slant_range_m=max_slant_range_m,
            is_port_starboard_split=is_port_starboard_split,
        )

        return ground_corrected, metadata
