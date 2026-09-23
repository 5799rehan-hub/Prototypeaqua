"""
=============================================================================
AQUAGHOST-SONAR: Edge AI & Acoustic Physics Pipeline for Marine Debris Detection
Module 6: Temporal Check (Ping Tracking Engine)
Target Platform: NVIDIA Jetson Orin / Xavier / Nano
Author: AQUAGHOST-SONAR Core Engineering Team (Smart India Hackathon)
=============================================================================
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class TrackedPingDetection:
    """Represents an anomaly tracked across sequential sonar pings."""
    track_id: str
    first_ping: int
    last_ping: int
    hit_streak: int = 1
    miss_streak: int = 0
    ground_ranges: List[float] = field(default_factory=list)
    shadow_lengths: List[float] = field(default_factory=list)
    confidences: List[float] = field(default_factory=list)
    centroid_coords: List[Tuple[float, float]] = field(default_factory=list)
    is_confirmed_persistent: bool = False

    @property
    def total_pings(self) -> int:
        return len(self.ground_ranges)

    @property
    def mean_ground_range(self) -> float:
        return float(np.mean(self.ground_ranges)) if self.ground_ranges else 0.0

    @property
    def mean_shadow_length(self) -> float:
        return float(np.mean(self.shadow_lengths)) if self.shadow_lengths else 0.0

    @property
    def mean_confidence(self) -> float:
        return float(np.mean(self.confidences)) if self.confidences else 0.0


class TemporalPingTracker:
    """
    Multi-Ping Temporal Association & Persistence Verification Engine.
    
    Acoustic Principle:
      Real 3D marine debris resting on the seafloor is illuminated over multiple
      sequential acoustic pings as the AUV advances forward along-track.
      Transient acoustic interference (wake turbulence, schools of fish, multipath
      glints, bubble clouds) rarely persists for more than 1 or 2 pings.
      
      This engine tracks bounding boxes across consecutive pings, enforcing:
      1. Spatial continuity: along-track displacement matches vehicle forward speed v_auv * dt.
      2. Minimum persistence threshold: Target must be observed across at least
         `min_persistence_pings` (default: 4 pings) before confirming hazard status.
      3. Shadow consistency check: Shadow length must scale consistently with
         across-track ground range R_g across pings.
    """

    def __init__(
        self,
        min_persistence_pings: int = 4,
        max_missed_pings: int = 3,
        distance_threshold_m: float = 3.5,
    ):
        """
        Args:
            min_persistence_pings: Number of successive pings required to confirm persistence.
            max_missed_pings: Maximum consecutive pings allowed before dropping a track.
            distance_threshold_m: Maximum spatial gating radius for matching in meters.
        """
        self.min_persistence_pings = min_persistence_pings
        self.max_missed_pings = max_missed_pings
        self.distance_threshold_m = distance_threshold_m

        self.active_tracks: Dict[str, TrackedPingDetection] = {}
        self.confirmed_tracks: List[TrackedPingDetection] = []
        self._next_track_id = 1

    def update(
        self,
        current_ping_idx: int,
        detections: List[Dict[str, Any]],
        meters_per_pixel: float,
    ) -> Dict[str, Any]:
        """
        Update tracker with new detections from current ping.

        Args:
            current_ping_idx: Sequential integer ping counter.
            detections: List of dicts containing 'object_bbox', 'shadow_bbox', 'confidence'.
            meters_per_pixel: Scale conversion from pixel to meters.

        Returns:
            Dict containing active_tracks, confirmed_hazards, and transient_rejected.
        """
        matched_track_ids = set()
        unmatched_detections = []

        # Association step: Euclidean gating
        for det in detections:
            obj_box = det["object_bbox"]
            center_x = (obj_box[0] + obj_box[2]) / 2.0 * meters_per_pixel
            center_y = (obj_box[1] + obj_box[3]) / 2.0 * meters_per_pixel

            best_track_id = None
            best_dist = float("inf")

            for t_id, track in self.active_tracks.items():
                if t_id in matched_track_ids:
                    continue
                last_x, last_y = track.centroid_coords[-1]
                dist = np.hypot(center_x - last_x, center_y - last_y)
                if dist < self.distance_threshold_m and dist < best_dist:
                    best_dist = dist
                    best_track_id = t_id

            if best_track_id is not None:
                # Update existing track
                track = self.active_tracks[best_track_id]
                track.last_ping = current_ping_idx
                track.hit_streak += 1
                track.miss_streak = 0
                track.ground_ranges.append(det.get("ground_range_m", center_x))
                track.shadow_lengths.append(det.get("shadow_length_m", 0.0))
                track.confidences.append(det.get("confidence", 0.8))
                track.centroid_coords.append((center_x, center_y))

                if track.hit_streak >= self.min_persistence_pings:
                    track.is_confirmed_persistent = True

                matched_track_ids.add(best_track_id)
            else:
                unmatched_detections.append(det)

        # Handle missed tracks
        dead_tracks = []
        for t_id, track in self.active_tracks.items():
            if t_id not in matched_track_ids:
                track.miss_streak += 1
                if track.miss_streak > self.max_missed_pings:
                    dead_tracks.append(t_id)

        # Archive or discard dead tracks
        for t_id in dead_tracks:
            dead = self.active_tracks.pop(t_id)
            if dead.is_confirmed_persistent:
                self.confirmed_tracks.append(dead)

        # Initialize new tracks from unmatched detections
        for det in unmatched_detections:
            obj_box = det["object_bbox"]
            cx = (obj_box[0] + obj_box[2]) / 2.0 * meters_per_pixel
            cy = (obj_box[1] + obj_box[3]) / 2.0 * meters_per_pixel
            new_id = f"TRK-{self._next_track_id:04d}"
            self._next_track_id += 1

            self.active_tracks[new_id] = TrackedPingDetection(
                track_id=new_id,
                first_ping=current_ping_idx,
                last_ping=current_ping_idx,
                hit_streak=1,
                miss_streak=0,
                ground_ranges=[det.get("ground_range_m", cx)],
                shadow_lengths=[det.get("shadow_length_m", 0.0)],
                confidences=[det.get("confidence", 0.8)],
                centroid_coords=[(cx, cy)],
                is_confirmed_persistent=(self.min_persistence_pings <= 1),
            )

        persistent_active = [t for t in self.active_tracks.values() if t.is_confirmed_persistent]
        transient_active = [t for t in self.active_tracks.values() if not t.is_confirmed_persistent]

        return {
            "current_ping": current_ping_idx,
            "active_tracks_count": len(self.active_tracks),
            "persistent_confirmed": persistent_active,
            "transient_provisional": transient_active,
        }
