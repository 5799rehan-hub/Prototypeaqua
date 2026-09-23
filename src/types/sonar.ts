export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnomalyStatus = 'CONFIRMED_HAZARD' | 'REJECTED_FALSE_POSITIVE';
export type TemporalStatus = 'VERIFIED_PERSISTENT' | 'REJECTED_TRANSIENT' | 'PROVISIONAL_TRACK';

export interface SonarTarget {
  id: string;
  name: string;
  type: 'ghost_net' | 'derelict_trap' | 'flat_rock' | 'sand_ripple' | 'sunken_cylinder' | 'transient_clutter';
  highlightBBox: BBox;
  shadowBBox: BBox | null;
  fusedBBox?: BBox; // Unified multi-scale boundary box combining highlight echo & shadow relief
  groundRangeRg: number; // in meters
  shadowLengthL: number; // in meters
  objectLength: number; // in meters
  objectWidth: number; // in meters
  calculatedHeight: number; // in meters: h = (H * L) / (Rg + L)
  heightUncertainty: number; // sigma_h
  aiConfidence: number; // 0.0 - 1.0 from backbone

  // RepDNet Physics-Informed Model parameters
  repdnetPhysicsScore: number; // Physics consistency score (0 - 100%)
  repdnetEebEdgeGradient: number; // Edge Enhancement Block gradient score (0.0 - 1.0)
  repdnetPsbNoiseReductionDb: number; // Pixel Smoothing Block despeckle SNR improvement (dB)
  repdnetLoss: number; // Physics-informed geometric loss |h_pred - h_geo|

  // Multi-Scale Feature Fusion Tri-Heads
  objectDetectorScore: number; // Head A: highlight echo detection confidence (0.0 - 1.0)
  shadowAnalysisScore: number; // Head B: shadow presence & boundary confidence (0.0 - 1.0)
  anomalyDetectorScore: number; // Head C: non-seafloor textural anomaly density score (0.0 - 1.0)
  triFeatureAgreement: number; // % cross-head feature consistency (0 - 100%)
  fusedConfidenceScore: number; // Final fused confidence score after multi-scale comparison (0 - 100%)
  fusedRiskScore: number; // 0 - 100%

  // Multi-Ping Temporal Check parameters
  temporalTrackId: string; // e.g. TRK-0001
  temporalHitStreak: number; // Consecutive pings with positive detection
  temporalPersistenceScore: number; // 0 - 100% multi-ping temporal stability
  temporalSpatialDriftM: number; // Trajectory spatial drift in meters
  temporalStatus: TemporalStatus;

  // Final Pipeline Decision
  status: AnomalyStatus;
  rejectionReason?: string;
  latitude: number;
  longitude: number;
  depthMeters: number;
  pingIndex: number;
  timestamp: string;

  // Dedicated Acoustic Shadow Analysis Module parameters
  shadowContrastDb?: number; // Decibel contrast difference: 10 * log10(I_seabed / I_shadow)
  shadowMorphology?: 'draped_mesh' | 'rigid_geometric' | 'diffuse_bedform' | 'negligible';
  shadowPenumbraMeters?: number; // Transition gradient width
  grazingAngleDeg?: number; // theta_g = arcsin(H / Rs) in degrees
}

export interface SonarMissionTelemetry {
  missionId: string;
  locationName: string;
  auvAltitudeH: number; // meters (H)
  maxSlantRange: number; // meters (R_s,max)
  operatingFrequencyKhz: number; // e.g. 450 kHz
  soundSpeed: number; // m/s (1500)
  waterDepth: number; // meters
  headingDeg: number;
  speedKnots: number;
  batteryPercent: number;
  jetsonGpuLoad: number; // %
  jetsonTempC: number;
  jetsonPowerWatts: number;
  fps: number;
}

export interface PreprocessingParams {
  tvgSpreadingFactor: number; // e.g. 35 dB
  absorptionAlpha: number; // dB/km (e.g. 95)
  speckleKernelSize: number; // 3, 5, 7
  speckleStrength: number; // 0.1 - 1.0
  unwarpPythagorean: boolean;
  minHeightThreshold: number; // e.g. 0.20 meters (RepDNet physics gate floor)
  temporalMinStreak?: number; // e.g. 3 consecutive pings required
  temporalMaxDriftM?: number; // e.g. 0.40 meters max drift allowed
  repdnetEebStrength?: number; // e.g. 1.2x edge enhancement weight
  minShadowContrastDb?: number; // e.g. 12 dB minimum shadow extinction threshold
  minShadowLengthThreshold?: number; // e.g. 0.50 meters minimum shadow length
}

export type ViewFilterMode = 'raw' | 'tvg' | 'speckle_filtered' | 'ground_unwarped';

export type WorkspaceMode = 'live' | 'upload';

export interface SonarBenchmarkPreset {
  id: string;
  name: string;
  location: string;
  description: string;
  altitudeH: number;
  maxSlantRange: number;
  operatingFrequencyKhz: number;
  sampleTargets: SonarTarget[];
}
