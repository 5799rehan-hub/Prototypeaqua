import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

export const INITIAL_MISSION_TELEMETRY: SonarMissionTelemetry = {
  missionId: 'AUV-AQUAGHOST-2026-08',
  locationName: 'Gulf of Mannar Biosphere Reserve (Sector C-4)',
  auvAltitudeH: 12.0, // 12 meters altitude
  maxSlantRange: 50.0, // 50m range per side
  operatingFrequencyKhz: 450,
  soundSpeed: 1512, // m/s
  waterDepth: 34.5, // meters
  headingDeg: 142.4,
  speedKnots: 2.8,
  batteryPercent: 88,
  jetsonGpuLoad: 41, // %
  jetsonTempC: 48,
  jetsonPowerWatts: 14.2, // 15W mode
  fps: 58.4,
};

export const INITIAL_TARGETS: SonarTarget[] = [
  {
    id: 'AQUAGHOST-TGT-001',
    name: 'Monofilament Ghost Net & Entangled Floats',
    type: 'ghost_net',
    highlightBBox: { x: 520, y: 140, width: 44, height: 60 },
    shadowBBox: { x: 564, y: 140, width: 68, height: 60 },
    fusedBBox: { x: 520, y: 140, width: 112, height: 60 },
    groundRangeRg: 18.5,
    shadowLengthL: 6.8,
    objectLength: 5.4,
    objectWidth: 3.2,
    calculatedHeight: 1.48, // (12 * 6.8) / (18.5 + 6.8) ~= 1.48m
    heightUncertainty: 0.08,
    aiConfidence: 0.94,

    // RepDNet Physics-Informed Model parameters
    repdnetPhysicsScore: 95,
    repdnetEebEdgeGradient: 0.94,
    repdnetPsbNoiseReductionDb: 15.6,
    repdnetLoss: 0.042,

    // Multi-Scale Feature Fusion Tri-Heads
    objectDetectorScore: 0.94,
    shadowAnalysisScore: 0.93,
    anomalyDetectorScore: 0.92,
    triFeatureAgreement: 93.5,
    fusedConfidenceScore: 93.4,
    fusedRiskScore: 94,

    // Multi-Ping Temporal Check parameters
    temporalTrackId: 'TRK-0001',
    temporalHitStreak: 14,
    temporalPersistenceScore: 96,
    temporalSpatialDriftM: 0.12,
    temporalStatus: 'VERIFIED_PERSISTENT',

    status: 'CONFIRMED_HAZARD',
    latitude: 9.184215,
    longitude: 79.124580,
    depthMeters: 33.2,
    pingIndex: 1142,
    timestamp: '10:14:22 UTC',

    // Dedicated Acoustic Shadow Analysis Module parameters
    shadowContrastDb: 22.4,
    shadowMorphology: 'draped_mesh',
    shadowPenumbraMeters: 0.18,
    grazingAngleDeg: 33.0,
  },
  {
    id: 'AQUAGHOST-TGT-002',
    name: 'Submerged Sandstone Slab & Shell Hash',
    type: 'flat_rock',
    highlightBBox: { x: 260, y: 220, width: 38, height: 35 },
    shadowBBox: { x: 222, y: 220, width: 38, height: 35 }, // very short shadow: ~0.4m
    fusedBBox: { x: 222, y: 220, width: 76, height: 35 },
    groundRangeRg: 21.0,
    shadowLengthL: 0.42,
    objectLength: 3.8,
    objectWidth: 3.1,
    calculatedHeight: 0.09, // (12 * 0.42) / (21.0 + 0.42) = 0.23m or less
    heightUncertainty: 0.03,
    aiConfidence: 0.82,

    // RepDNet Physics-Informed Model parameters
    repdnetPhysicsScore: 12,
    repdnetEebEdgeGradient: 0.21,
    repdnetPsbNoiseReductionDb: 11.2,
    repdnetLoss: 0.485,

    // Multi-Scale Feature Fusion Tri-Heads
    objectDetectorScore: 0.82,
    shadowAnalysisScore: 0.12,
    anomalyDetectorScore: 0.18,
    triFeatureAgreement: 18.2,
    fusedConfidenceScore: 14.2,
    fusedRiskScore: 8,

    // Multi-Ping Temporal Check parameters
    temporalTrackId: 'TRK-0002',
    temporalHitStreak: 8,
    temporalPersistenceScore: 85,
    temporalSpatialDriftM: 0.15,
    temporalStatus: 'VERIFIED_PERSISTENT',

    status: 'REJECTED_FALSE_POSITIVE',
    rejectionReason: 'RepDNet Physics Gate: Calculated physical elevation (0.09m) < 0.20m floor. RepDNet Edge Enhancement Block (EEB) indicates specular highlight without vertical 3D relief. Classified as natural flat rock.',
    latitude: 9.183890,
    longitude: 79.125120,
    depthMeters: 34.0,
    pingIndex: 1188,
    timestamp: '10:14:58 UTC',
    shadowContrastDb: 4.2,
    shadowMorphology: 'diffuse_bedform',
    shadowPenumbraMeters: 0.08,
    grazingAngleDeg: 29.7,
  },
  {
    id: 'AQUAGHOST-TGT-003',
    name: 'Derelict Crab Trap & Nylon Cordage',
    type: 'derelict_trap',
    highlightBBox: { x: 595, y: 310, width: 28, height: 30 },
    shadowBBox: { x: 623, y: 310, width: 38, height: 30 },
    fusedBBox: { x: 595, y: 310, width: 66, height: 30 },
    groundRangeRg: 28.2,
    shadowLengthL: 3.4,
    objectLength: 2.1,
    objectWidth: 1.8,
    calculatedHeight: 0.78, // (12 * 3.4) / (28.2 + 3.4) = 0.78m
    heightUncertainty: 0.06,
    aiConfidence: 0.89,

    // RepDNet Physics-Informed Model parameters
    repdnetPhysicsScore: 88,
    repdnetEebEdgeGradient: 0.86,
    repdnetPsbNoiseReductionDb: 14.8,
    repdnetLoss: 0.065,

    // Multi-Scale Feature Fusion Tri-Heads
    objectDetectorScore: 0.89,
    shadowAnalysisScore: 0.85,
    anomalyDetectorScore: 0.84,
    triFeatureAgreement: 86.5,
    fusedConfidenceScore: 86.8,
    fusedRiskScore: 82,

    // Multi-Ping Temporal Check parameters
    temporalTrackId: 'TRK-0003',
    temporalHitStreak: 9,
    temporalPersistenceScore: 92,
    temporalSpatialDriftM: 0.16,
    temporalStatus: 'VERIFIED_PERSISTENT',

    status: 'CONFIRMED_HAZARD',
    latitude: 9.183420,
    longitude: 79.125840,
    depthMeters: 34.8,
    pingIndex: 1240,
    timestamp: '10:15:42 UTC',
    shadowContrastDb: 20.8,
    shadowMorphology: 'rigid_geometric',
    shadowPenumbraMeters: 0.14,
    grazingAngleDeg: 23.1,
  },
  {
    id: 'AQUAGHOST-TGT-004',
    name: 'Sand Wave Crest & Ripple Bedform',
    type: 'sand_ripple',
    highlightBBox: { x: 190, y: 80, width: 55, height: 25 },
    shadowBBox: null, // Zero trailing shadow
    fusedBBox: { x: 190, y: 80, width: 55, height: 25 },
    groundRangeRg: 31.4,
    shadowLengthL: 0.0,
    objectLength: 6.2,
    objectWidth: 2.5,
    calculatedHeight: 0.02,
    heightUncertainty: 0.01,
    aiConfidence: 0.76,

    // RepDNet Physics-Informed Model parameters
    repdnetPhysicsScore: 6,
    repdnetEebEdgeGradient: 0.12,
    repdnetPsbNoiseReductionDb: 10.4,
    repdnetLoss: 0.620,

    // Multi-Scale Feature Fusion Tri-Heads
    objectDetectorScore: 0.76,
    shadowAnalysisScore: 0.02,
    anomalyDetectorScore: 0.08,
    triFeatureAgreement: 9.4,
    fusedConfidenceScore: 7.8,
    fusedRiskScore: 6,

    // Multi-Ping Temporal Check parameters
    temporalTrackId: 'TRK-0004',
    temporalHitStreak: 6,
    temporalPersistenceScore: 78,
    temporalSpatialDriftM: 0.22,
    temporalStatus: 'VERIFIED_PERSISTENT',

    status: 'REJECTED_FALSE_POSITIVE',
    rejectionReason: 'RepDNet Physics Gate: Zero shadow detected. RepDNet Pixel Smoothing Block (PSB) confirms periodic bedform ripple texture without acoustic relief.',
    latitude: 9.184850,
    longitude: 79.123910,
    depthMeters: 32.5,
    pingIndex: 1095,
    timestamp: '10:13:48 UTC',
    shadowContrastDb: 1.2,
    shadowMorphology: 'negligible',
    shadowPenumbraMeters: 0.00,
    grazingAngleDeg: 20.9,
  },
  {
    id: 'AQUAGHOST-TGT-005',
    name: 'Industrial Metal Drum / Pressure Vessel',
    type: 'sunken_cylinder',
    highlightBBox: { x: 480, y: 370, width: 30, height: 32 },
    shadowBBox: { x: 510, y: 370, width: 42, height: 32 },
    fusedBBox: { x: 480, y: 370, width: 72, height: 32 },
    groundRangeRg: 14.8,
    shadowLengthL: 3.6,
    objectLength: 2.4,
    objectWidth: 1.6,
    calculatedHeight: 1.15, // (12 * 3.6) / (14.8 + 3.6) = 1.15m
    heightUncertainty: 0.07,
    aiConfidence: 0.91,

    // RepDNet Physics-Informed Model parameters
    repdnetPhysicsScore: 91,
    repdnetEebEdgeGradient: 0.90,
    repdnetPsbNoiseReductionDb: 15.1,
    repdnetLoss: 0.051,

    // Multi-Scale Feature Fusion Tri-Heads
    objectDetectorScore: 0.91,
    shadowAnalysisScore: 0.90,
    anomalyDetectorScore: 0.88,
    triFeatureAgreement: 89.8,
    fusedConfidenceScore: 89.6,
    fusedRiskScore: 87,

    // Multi-Ping Temporal Check parameters
    temporalTrackId: 'TRK-0005',
    temporalHitStreak: 11,
    temporalPersistenceScore: 94,
    temporalSpatialDriftM: 0.14,
    temporalStatus: 'VERIFIED_PERSISTENT',

    status: 'CONFIRMED_HAZARD',
    latitude: 9.182950,
    longitude: 79.126420,
    depthMeters: 35.1,
    pingIndex: 1290,
    timestamp: '10:16:20 UTC',
    shadowContrastDb: 24.5,
    shadowMorphology: 'rigid_geometric',
    shadowPenumbraMeters: 0.12,
    grazingAngleDeg: 39.0,
  },
  {
    id: 'AQUAGHOST-TGT-006',
    name: 'Transient Pelagic Fish School / Bubble Wake',
    type: 'transient_clutter',
    highlightBBox: { x: 620, y: 60, width: 32, height: 28 },
    shadowBBox: { x: 652, y: 60, width: 22, height: 28 },
    fusedBBox: { x: 620, y: 60, width: 54, height: 28 },
    groundRangeRg: 24.6,
    shadowLengthL: 1.8,
    objectLength: 2.2,
    objectWidth: 1.5,
    calculatedHeight: 0.82,
    heightUncertainty: 0.12,
    aiConfidence: 0.84, // Single-frame CNN flagged this

    // RepDNet Physics-Informed Model parameters
    repdnetPhysicsScore: 74,
    repdnetEebEdgeGradient: 0.58,
    repdnetPsbNoiseReductionDb: 12.0,
    repdnetLoss: 0.142,

    // Multi-Scale Feature Fusion Tri-Heads
    objectDetectorScore: 0.84,
    shadowAnalysisScore: 0.65,
    anomalyDetectorScore: 0.70,
    triFeatureAgreement: 72.0,
    fusedConfidenceScore: 74.5,
    fusedRiskScore: 15,

    // Multi-Ping Temporal Check parameters
    temporalTrackId: 'TRK-0006',
    temporalHitStreak: 1, // Only 1 ping! Failed temporal check!
    temporalPersistenceScore: 18,
    temporalSpatialDriftM: 2.94, // Drifting fast through water column
    temporalStatus: 'REJECTED_TRANSIENT',

    status: 'REJECTED_FALSE_POSITIVE',
    rejectionReason: 'Failed Temporal Check: Detected for only 1 isolated ping (hit streak = 1 < 3 required). Spatial drift of 2.94m confirms non-stationary water column target. Filtered out as transient biological noise.',
    latitude: 9.184510,
    longitude: 79.124190,
    depthMeters: 28.4,
    pingIndex: 1144,
    timestamp: '10:14:26 UTC',
    shadowContrastDb: 8.5,
    shadowMorphology: 'diffuse_bedform',
    shadowPenumbraMeters: 0.45,
    grazingAngleDeg: 26.0,
  },
];
