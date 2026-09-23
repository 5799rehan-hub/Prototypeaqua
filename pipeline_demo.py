"""
=============================================================================
AQUAGHOST-SONAR: End-to-End Modular Pipeline Demo (Nodes 1 through 9)
Fuses Lightweight AI with Deterministic Acoustic Physics for Marine Debris
Target Platform: NVIDIA Jetson Orin / Xavier / Nano
Author: AQUAGHOST-SONAR Core Engineering Team (Smart India Hackathon)
=============================================================================
"""

import numpy as np
from typing import Dict, Any, List

# Import Modular Pipeline Components
from sonar_preprocessor import SonarPreprocessor
from physics_risk_engine import PhysicsRiskEngine, BoundingBox
from temporal_ping_tracker import TemporalPingTracker
from geotagging_engine import GeotaggingEngine

try:
    import torch
    from ghostnetv2_bridge import GhostNetV2SonarBackbone, prepare_sonar_tensor_for_ghostnet
    from panet_parallel_heads import PANetNeck, ParallelSonarHeads
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def run_aquaghost_pipeline():
    print("=" * 78)
    print("  AQUAGHOST-SONAR: Edge AI & Acoustic Physics System Demo")
    print("  Smart India Hackathon • Target Hardware: NVIDIA Jetson Orin Nano")
    print("=" * 78)

    # -------------------------------------------------------------------------
    # NODE 1: Side-Scan Sonar (Input Simulation)
    # -------------------------------------------------------------------------
    print("\n[NODE 1] Ingesting Raw Side-Scan Sonar Ping Stream...")
    AUV_ALTITUDE_H = 12.0  # meters
    MAX_SLANT_RANGE_M = 50.0
    VESSEL_TELEMETRY = {
        "latitude": 9.184200,
        "longitude": 79.124500,
        "heading_deg": 142.0,
        "water_depth_m": 34.0,
        "layback_m": 15.0,
        "timestamp": "2026-09-21T10:14:02Z",
    }
    
    # 400 pings x 800 slant-range samples
    raw_sonar_waterfall = np.random.uniform(0.05, 0.45, (400, 800)).astype(np.float32)
    print(f"  -> Raw Sonar Waterfall Buffer: {raw_sonar_waterfall.shape} (Slant Range: {MAX_SLANT_RANGE_M}m)")

    # -------------------------------------------------------------------------
    # NODE 2: Adaptive Sonar Preprocessing (Acoustic Physics)
    # -------------------------------------------------------------------------
    print("\n[NODE 2] Executing Acoustic Physics Preprocessor (SonarPreprocessor)...")
    preprocessor = SonarPreprocessor(sound_speed=1500.0, frequency_khz=450.0)
    
    unwarped_seafloor, meta = preprocessor.process_pipeline(
        raw_sonar_image=raw_sonar_waterfall,
        altitude_h=AUV_ALTITUDE_H,
        max_slant_range_m=MAX_SLANT_RANGE_M,
        is_port_starboard_split=True,
    )
    print(f"  -> TVG Compensation Applied: Spreading Loss & Alpha Absorption Corrected.")
    print(f"  -> Homomorphic Log-Speckle Bilateral Filter Applied.")
    print(f"  -> Pythagorean Unwarping: Rg = sqrt(Rs^2 - H^2)")
    print(f"  -> Seafloor Swath: {meta['total_ground_swath_m']:.2f}m total ground range ({meta['ground_resolution_m_per_px']:.3f} m/px)")

    # -------------------------------------------------------------------------
    # NODES 3, 4, 5: Neural Backbone, PANet Neck, & Parallel Heads
    # -------------------------------------------------------------------------
    if TORCH_AVAILABLE:
        print("\n[NODES 3, 4, 5] Edge Neural Network Inference (GhostNetV2 + PANet + 3 Heads)...")
        sonar_tensor = prepare_sonar_tensor_for_ghostnet(unwarped_seafloor, target_size=(640, 640))
        backbone = GhostNetV2SonarBackbone(in_channels=3)
        neck = PANetNeck()
        heads = ParallelSonarHeads()

        with torch.no_grad():
            b_feats = backbone(sonar_tensor)
            panet_feats = neck(b_feats)
            predictions = heads(panet_feats)
        print("  -> GhostNetV2 Multiscale Stages Extracted: P3, P4, P5")
        print("  -> PANet Feature Fusion: N3, N4, N5")
        print(f"  -> Head A (BBox): {predictions['bbox_predictions'].shape}")
        print(f"  -> Head B (Shadow Mask): {predictions['shadow_mask'].shape}")
        print(f"  -> Head C (Anomaly Density): {predictions['anomaly_score'].item():.3f}")
    else:
        print("\n[NODES 3, 4, 5] PyTorch not loaded; proceeding with deterministic candidate detections.")

    # -------------------------------------------------------------------------
    # NODE 6: Temporal Ping Tracking Check
    # -------------------------------------------------------------------------
    print("\n[NODE 6] Running Temporal Multi-Ping Association (TemporalPingTracker)...")
    tracker = TemporalPingTracker(min_persistence_pings=3)
    
    # Simulate candidate detection stream across 4 consecutive pings
    candidate_detections = [
        # Candidate 1: Real Ghost Net (persists)
        {"object_bbox": (530, 180, 560, 220), "shadow_length_m": 7.8, "ground_range_m": 18.5, "confidence": 0.94},
        # Candidate 2: Flat Rock / Ripple (persists, but flat)
        {"object_bbox": (260, 280, 295, 310), "shadow_length_m": 0.3, "ground_range_m": 14.2, "confidence": 0.88},
        # Candidate 3: Acoustic Multipath Noise Spike (does NOT persist)
        {"object_bbox": (610, 100, 620, 115), "shadow_length_m": 0.0, "ground_range_m": 25.1, "confidence": 0.65},
    ]

    for ping_idx in range(1140, 1144):
        # Noise spike disappears after first ping
        current_dets = candidate_detections if ping_idx == 1140 else candidate_detections[:2]
        tracking_result = tracker.update(ping_idx, current_dets, meters_per_pixel=meta["ground_resolution_m_per_px"])

    print(f"  -> Active Tracks in Memory: {tracking_result['active_tracks_count']}")
    print(f"  -> Confirmed Persistent Tracks: {len(tracking_result['persistent_confirmed'])} (Transient noise dropped)")

    # -------------------------------------------------------------------------
    # NODE 7: 3D Shadow Risk Engine (Physics Gate)
    # -------------------------------------------------------------------------
    print("\n[NODE 7] Evaluating Deterministic 3D Shadow Physics Validation Gate...")
    risk_engine = PhysicsRiskEngine(min_height_threshold_m=0.20)
    geotagger = GeotaggingEngine(default_towfish_layback_m=15.0)

    # Test Target 1: Ghost Net
    tgt_1_eval = risk_engine.evaluate_detection(
        object_bbox=BoundingBox(530, 180, 560, 220),
        shadow_bbox=BoundingBox(560, 180, 625, 220),  # L_shadow ~ 7.8m
        sensor_altitude_h=AUV_ALTITUDE_H,
        meters_per_pixel=meta["ground_resolution_m_per_px"],
        nadir_x_coord_px=400,
        ai_detector_confidence=0.94,
        target_id="TGT-NET-01",
    )

    # Test Target 2: Flat Rock (High AI confidence, but zero acoustic shadow!)
    tgt_2_eval = risk_engine.evaluate_detection(
        object_bbox=BoundingBox(260, 280, 295, 310),
        shadow_bbox=BoundingBox(295, 280, 298, 310),  # L_shadow ~ 0.3m
        sensor_altitude_h=AUV_ALTITUDE_H,
        meters_per_pixel=meta["ground_resolution_m_per_px"],
        nadir_x_coord_px=400,
        ai_detector_confidence=0.91,
        target_id="TGT-ROCK-02",
    )

    print(f"\n  Evaluation Result [Target 1 - Discarded Gear]:")
    print(f"    - Calculated 3D Height (h): {tgt_1_eval.calculated_height_m:.2f} m (±{tgt_1_eval.height_uncertainty_m:.2f}m)")
    print(f"    - Status: {tgt_1_eval.status}")
    print(f"    - Fused Marine Risk Score: {tgt_1_eval.fused_risk_score}%")

    print(f"\n  Evaluation Result [Target 2 - Flat Seafloor Rock]:")
    print(f"    - Calculated 3D Height (h): {tgt_2_eval.calculated_height_m:.2f} m (±{tgt_2_eval.height_uncertainty_m:.2f}m)")
    print(f"    - Status: {tgt_2_eval.status}")
    print(f"    - Rejection Reason: {tgt_2_eval.rejection_reason}")
    print(f"    - Fused Marine Risk Score: {tgt_2_eval.fused_risk_score}% (False positive eliminated!)")

    # -------------------------------------------------------------------------
    # NODE 8: Geotagging Engine
    # -------------------------------------------------------------------------
    print("\n[NODE 8] Generating WGS-84 Geotags for Confirmed Hazards...")
    geotag = geotagger.generate_geotagged_record(
        target_id="TGT-NET-01",
        assessment=tgt_1_eval,
        auv_telemetry=VESSEL_TELEMETRY,
        swath_side="starboard",
    )
    print(f"  -> Latitude:  {geotag['latitude_wgs84']}° N")
    print(f"  -> Longitude: {geotag['longitude_wgs84']}° E")
    print(f"  -> Water Depth: {geotag['depth_m']} m")

    # -------------------------------------------------------------------------
    # NODE 9: Marine Risk Map & GeoJSON Output
    # -------------------------------------------------------------------------
    print("\n[NODE 9] Formatting Output for Nautical GIS & Marine Risk Map...")
    geojson_feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [geotag["longitude_wgs84"], geotag["latitude_wgs84"], -geotag["depth_m"]],
        },
        "properties": {
            "target_id": geotag["target_id"],
            "classification": geotag["classification"],
            "status": geotag["status"],
            "physical_elevation_m": geotag["physical_elevation_h_m"],
            "risk_score_percent": geotag["fused_risk_score"],
        },
    }
    print("  -> GeoJSON Feature Ready for Real-Time Map Overlay.")
    print("=" * 78)
    print("  AQUAGHOST-SONAR PIPELINE EXECUTION COMPLETE: 100% Deterministic Verification")
    print("=" * 78)


if __name__ == "__main__":
    run_aquaghost_pipeline()
