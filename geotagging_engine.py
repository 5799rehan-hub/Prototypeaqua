"""
=============================================================================
AQUAGHOST-SONAR: Edge AI & Acoustic Physics Pipeline for Marine Debris Detection
Module 8: Acoustic Geotagging & Coordinate Transformation Engine
Target Platform: NVIDIA Jetson Orin / Xavier / Nano
Author: AQUAGHOST-SONAR Core Engineering Team (Smart India Hackathon)
=============================================================================
"""

import numpy as np
from typing import Dict, Any, Tuple, Optional


class GeotaggingEngine:
    """
    Acoustic Geotagging Engine:
    Transforms side-scan sonar image detections into true WGS-84 Earth coordinates.
    
    Acoustic Navigation Math:
      1. Corrects for Towfish Layback distance behind surface GPS antenna:
         X_towfish = X_ship - L_layback * sin(heading)
         Y_towfish = Y_ship - L_layback * cos(heading)
      2. Projects target across-track ground range (R_g) orthogonal to vehicle heading:
         Bearing_target = Heading + 90 deg (if Starboard) or Heading - 90 deg (if Port)
      3. Computes Target WGS-84 Geodetic Latitude & Longitude using WGS-84 Earth ellipsoid.
    """

    # WGS-84 Ellipsoid Constants
    WGS84_A = 6378137.0         # Semi-major axis (meters)
    WGS84_F = 1.0 / 298.257223563  # Flattening
    WGS84_B = 6356752.314245    # Semi-minor axis (meters)

    def __init__(self, default_towfish_layback_m: float = 0.0):
        self.default_towfish_layback_m = float(default_towfish_layback_m)

    def calculate_target_coordinates(
        self,
        auv_latitude: float,
        auv_longitude: float,
        heading_deg: float,
        ground_range_rg_m: float,
        swath_side: str = "starboard",
        layback_m: Optional[float] = None,
    ) -> Tuple[float, float]:
        """
        Compute true WGS-84 coordinates of detected seafloor debris.

        Args:
            auv_latitude: AUV / Towfish latitude in decimal degrees.
            auv_longitude: AUV / Towfish longitude in decimal degrees.
            heading_deg: Heading angle in degrees (0 = True North, 90 = East).
            ground_range_rg_m: True physical across-track distance to object on seabed (R_g).
            swath_side: 'starboard' (right of track) or 'port' (left of track).
            layback_m: Distance behind surface vessel GPS antenna in meters.

        Returns:
            (target_latitude, target_longitude) in WGS-84 decimal degrees.
        """
        layback = layback_m if layback_m is not None else self.default_towfish_layback_m
        heading_rad = np.radians(heading_deg)

        # 1. Towfish Position relative to GPS fix
        d_north_towfish = -layback * np.cos(heading_rad)
        d_east_towfish = -layback * np.sin(heading_rad)

        # 2. Target Orthogonal Vector from Towfish Track
        if swath_side.lower() == "starboard":
            bearing_rad = heading_rad + np.pi / 2.0  # +90 degrees (starboard)
        else:
            bearing_rad = heading_rad - np.pi / 2.0  # -90 degrees (port)

        d_north_target = d_north_towfish + ground_range_rg_m * np.cos(bearing_rad)
        d_east_target = d_east_towfish + ground_range_rg_m * np.sin(bearing_rad)

        # 3. Flat-Earth / Local Tangent Plane Projection back to WGS-84 degrees
        lat_rad = np.radians(auv_latitude)
        meters_per_lat_deg = 111132.954 - 559.822 * np.cos(2 * lat_rad) + 1.175 * np.cos(4 * lat_rad)
        meters_per_lon_deg = (np.pi / 180.0) * self.WGS84_A * np.cos(lat_rad) / np.sqrt(1.0 - (2 * self.WGS84_F - self.WGS84_F**2) * np.sin(lat_rad)**2)

        target_lat = auv_latitude + (d_north_target / meters_per_lat_deg)
        target_lon = auv_longitude + (d_east_target / meters_per_lon_deg)

        return float(target_lat), float(target_lon)

    def generate_geotagged_record(
        self,
        target_id: str,
        assessment: Any,
        auv_telemetry: Dict[str, Any],
        swath_side: str = "starboard",
    ) -> Dict[str, Any]:
        """Produce standardized SIH / IMO compliant geotagged marine hazard record."""
        lat, lon = self.calculate_target_coordinates(
            auv_latitude=auv_telemetry.get("latitude", 9.1840),
            auv_longitude=auv_telemetry.get("longitude", 79.1240),
            heading_deg=auv_telemetry.get("heading_deg", 142.0),
            ground_range_rg_m=assessment.ground_range_m,
            swath_side=swath_side,
            layback_m=auv_telemetry.get("layback_m", 0.0),
        )

        return {
            "target_id": target_id,
            "status": assessment.status,
            "classification": assessment.classification,
            "latitude_wgs84": round(lat, 6),
            "longitude_wgs84": round(lon, 6),
            "depth_m": auv_telemetry.get("water_depth_m", 34.0),
            "physical_elevation_h_m": assessment.calculated_height_m,
            "shadow_length_m": assessment.shadow_length_m,
            "fused_risk_score": assessment.fused_risk_score,
            "timestamp": auv_telemetry.get("timestamp", "2026-09-21T10:14:00Z"),
        }
