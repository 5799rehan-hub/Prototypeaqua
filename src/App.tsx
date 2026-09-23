/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  Sliders, 
  Database, 
  FileCode, 
  ArrowRight,
  Zap,
  Layers,
  Clock,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { Header, ActiveTabType } from './components/Header';
import { SonarWaterfallViewer } from './components/SonarWaterfallViewer';
import { PhysicsGeometryViewer } from './components/PhysicsGeometryViewer';
import { MarineRiskMap } from './components/MarineRiskMap';
import { AnomalyReportTable } from './components/AnomalyReportTable';
import { PythonCodeViewer } from './components/PythonCodeViewer';
import { TelemetryControlPanel } from './components/TelemetryControlPanel';
import { ParallelHeadsViewer } from './components/ParallelHeadsViewer';
import { TemporalTrackerViewer } from './components/TemporalTrackerViewer';
import { GeotaggingCalculator } from './components/GeotaggingCalculator';
import { ShadowAnalysisViewer } from './components/ShadowAnalysisViewer';

import { SonarTarget, SonarMissionTelemetry, PreprocessingParams, WorkspaceMode } from './types/sonar';
import { INITIAL_MISSION_TELEMETRY, INITIAL_TARGETS } from './utils/mockSonarData';
import { evaluateRepDNetAndTemporalPipeline } from './utils/sonarAcousticMath';
import { UploadedImageAnalysisStudio } from './components/UploadedImageAnalysisStudio';
import { GmailHazardDispatcher } from './components/GmailHazardDispatcher';

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('live');
  const [activeTab, setActiveTab] = useState<ActiveTabType>('waterfall');
  const [telemetry, setTelemetry] = useState<SonarMissionTelemetry>(INITIAL_MISSION_TELEMETRY);
  const [targets, setTargets] = useState<SonarTarget[]>(INITIAL_TARGETS);
  const [selectedTarget, setSelectedTarget] = useState<SonarTarget | null>(INITIAL_TARGETS[0]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLiveScanning, setIsLiveScanning] = useState<boolean>(true);

  const [preprocessingParams, setPreprocessingParams] = useState<PreprocessingParams>({
    tvgSpreadingFactor: 35,
    absorptionAlpha: 95,
    speckleKernelSize: 5,
    speckleStrength: 0.65,
    unwarpPythagorean: true,
    minHeightThreshold: 0.20, // 20 cm floor
    temporalMinStreak: 3, // 3 consecutive pings
    temporalMaxDriftM: 0.40, // 0.40m spatial drift tolerance
  });

  // Re-run validation gate whenever altitude H, minHeightThreshold, or temporal thresholds change
  useEffect(() => {
    setTargets((prevTargets) =>
      prevTargets.map((tgt) => {
        const evalResult = evaluateRepDNetAndTemporalPipeline(
          tgt,
          telemetry.auvAltitudeH,
          preprocessingParams.minHeightThreshold,
          preprocessingParams.temporalMinStreak,
          preprocessingParams.temporalMaxDriftM
        );
        return {
          ...tgt,
          status: evalResult.status,
          temporalStatus: evalResult.temporalStatus,
          calculatedHeight: evalResult.calculatedHeight,
          heightUncertainty: evalResult.heightUncertainty,
          fusedRiskScore: evalResult.fusedRiskScore,
          fusedConfidenceScore: evalResult.fusedConfidenceScore ?? tgt.fusedConfidenceScore,
          triFeatureAgreement: evalResult.triFeatureAgreement ?? tgt.triFeatureAgreement,
          repdnetPhysicsScore: evalResult.repdnetPhysicsScore,
          repdnetEebEdgeGradient: evalResult.repdnetEebEdgeGradient,
          repdnetPsbNoiseReductionDb: evalResult.repdnetPsbNoiseReductionDb,
          repdnetLoss: evalResult.repdnetLoss,
          temporalHitStreak: evalResult.temporalHitStreak,
          temporalPersistenceScore: evalResult.temporalPersistenceScore,
          temporalSpatialDriftM: evalResult.temporalSpatialDriftM,
          fusedBBox: evalResult.fusedBBox ?? tgt.fusedBBox,
          rejectionReason: evalResult.rejectionReason,
        };
      })
    );
  }, [
    telemetry.auvAltitudeH,
    preprocessingParams.minHeightThreshold,
    preprocessingParams.temporalMinStreak,
    preprocessingParams.temporalMaxDriftM,
  ]);

  // Simulate pipeline execution
  const handleRunDetection = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
    }, 800);
  };

  const handleResetDefaults = () => {
    setTelemetry(INITIAL_MISSION_TELEMETRY);
    setPreprocessingParams({
      tvgSpreadingFactor: 35,
      absorptionAlpha: 95,
      speckleKernelSize: 5,
      speckleStrength: 0.65,
      unwarpPythagorean: true,
      minHeightThreshold: 0.20,
    });
  };

  const handleCustomImageUploaded = (file: File) => {
    // Automatically switch to Space 2 when a file is uploaded
    setWorkspaceMode('upload');
  };

  const handleExportReport = (format: 'csv' | 'json' | 'geojson') => {
    if (format === 'csv') {
      const header = 'Target_ID,Classification,Status,Temporal_Status,Hit_Streak,Spatial_Drift_m,RepDNet_Physics_Score_pct,Physical_Height_m,Shadow_Length_m,Ground_Range_m,AI_Confidence,Risk_Score,Latitude,Longitude,Depth_m\n';
      const rows = targets.map((t) => 
        `"${t.id}","${t.name}","${t.status}","${t.temporalStatus}",${t.temporalHitStreak},${t.temporalSpatialDriftM.toFixed(2)},${t.repdnetPhysicsScore},${t.calculatedHeight.toFixed(2)},${t.shadowLengthL.toFixed(2)},${t.groundRangeRg.toFixed(2)},${(t.aiConfidence * 100).toFixed(1)}%,${t.fusedRiskScore},${t.latitude.toFixed(6)},${t.longitude.toFixed(6)},${t.depthMeters.toFixed(1)}`
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AQUAGHOST_RepDNet_Detections_${Date.now()}.csv`;
      link.click();
    } else if (format === 'json') {
      const exportJson = {
        system: "AQUAGHOST",
        model: "RepDNet Physics-Informed Model & Multi-Ping Temporal Check",
        mission: telemetry.missionId,
        location: telemetry.locationName,
        altitude_m: telemetry.auvAltitudeH,
        swath_width_m: telemetry.maxSlantRange * 2,
        exported_at: new Date().toISOString(),
        total_targets: targets.length,
        confirmed_debris: targets.filter(t => t.status === 'CONFIRMED_HAZARD').length,
        targets: targets.map((t) => ({
          target_id: t.id,
          name: t.name,
          status: t.status,
          temporal_status: t.temporalStatus,
          temporal_hit_streak: t.temporalHitStreak,
          temporal_spatial_drift_m: t.temporalSpatialDriftM,
          repdnet_physics_score_pct: t.repdnetPhysicsScore,
          repdnet_loss: t.repdnetLoss,
          is_hazard: t.status === 'CONFIRMED_HAZARD',
          latitude: t.latitude,
          longitude: t.longitude,
          depth_m: t.depthMeters,
          calculated_3d_height_m: t.calculatedHeight,
          ground_range_rg_m: t.groundRangeRg,
          shadow_length_l_m: t.shadowLengthL,
          ai_confidence_pct: +(t.aiConfidence * 100).toFixed(1),
          fused_risk_score_pct: t.fusedRiskScore,
          rejection_reason: t.rejectionReason || null,
        })),
      };
      const blob = new Blob([JSON.stringify(exportJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AQUAGHOST_RepDNet_Detections_${Date.now()}.json`;
      link.click();
    } else {
      const geojson = {
        type: 'FeatureCollection',
        mission: telemetry.missionId,
        location: telemetry.locationName,
        pipeline: 'RepDNet Physics-Informed Model & Temporal Check',
        features: targets.map((t) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [t.longitude, t.latitude],
          },
          properties: {
            id: t.id,
            name: t.name,
            type: t.type,
            status: t.status,
            temporalStatus: t.temporalStatus,
            temporalHitStreak: t.temporalHitStreak,
            temporalSpatialDriftM: t.temporalSpatialDriftM,
            repdnetPhysicsScore: t.repdnetPhysicsScore,
            latitude: t.latitude,
            longitude: t.longitude,
            calculatedHeightMeters: t.calculatedHeight,
            shadowLengthMeters: t.shadowLengthL,
            groundRangeMeters: t.groundRangeRg,
            fusedRiskScore: t.fusedRiskScore,
            aiConfidence: t.aiConfidence,
            depthMeters: t.depthMeters,
            rejectionReason: t.rejectionReason || null,
          },
        })),
      };
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AQUAGHOST_RepDNet_Risk_Map_${Date.now()}.geojson`;
      link.click();
    }
  };

  const handleLoadPreset = (presetKey: string) => {
    if (presetKey === 'gulf_mannar') {
      setTelemetry((prev) => ({
        ...prev,
        locationName: 'Gulf of Mannar Biosphere Reserve (Sector C-4)',
        auvAltitudeH: 12.0,
      }));
    } else if (presetKey === 'shallow_trawler') {
      setTelemetry((prev) => ({
        ...prev,
        locationName: 'Palk Strait Coastal Shoal (Sector A-2)',
        auvAltitudeH: 8.5,
      }));
    } else {
      setTelemetry((prev) => ({
        ...prev,
        locationName: 'Continental Shelf Drop-off (Sector D-9)',
        auvAltitudeH: 18.0,
      }));
    }
    handleRunDetection();
  };

  // 10 Flowchart Stages for the visual architecture bar
  const flowchartStages = [
    { num: 1, label: 'Side-Scan Sonar (Input)', tab: 'waterfall' as ActiveTabType },
    { num: 2, label: 'Adaptive Sonar Preprocessing', tab: 'waterfall' as ActiveTabType, highlight: true },
    { num: 3, label: 'GhostNetV2 AI (Backbone)', tab: 'parallel_heads' as ActiveTabType },
    { num: 4, label: 'PANet Neck Feature Fusion', tab: 'parallel_heads' as ActiveTabType },
    { num: 5, label: 'Parallel Detector & Shadow Heads', tab: 'parallel_heads' as ActiveTabType, highlight: true },
    { num: 6, label: 'Temporal Ping Check', tab: 'temporal' as ActiveTabType, highlight: true },
    { num: 7, label: 'Shadow Analysis Module', tab: 'shadow_analysis' as ActiveTabType, highlight: true },
    { num: 8, label: 'RepDNet Physics Model', tab: 'physics3d' as ActiveTabType, highlight: true },
    { num: 9, label: 'Geo-Tagging Engine', tab: 'geotag' as ActiveTabType },
    { num: 10, label: 'Marine Risk Map (Output)', tab: 'map' as ActiveTabType },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Tactical Header */}
      <Header
        telemetry={telemetry}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workspaceMode={workspaceMode}
        setWorkspaceMode={setWorkspaceMode}
        onRunDetection={handleRunDetection}
        isProcessing={isProcessing}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* If Workspace is SPACE 2: UPLOAD & ANALYZE SONAR LOG */}
        {workspaceMode === 'upload' ? (
          <UploadedImageAnalysisStudio
            telemetry={telemetry}
            preprocessingParams={preprocessingParams}
            setPreprocessingParams={setPreprocessingParams}
            onExportReport={handleExportReport}
          />
        ) : (
          /* SPACE 1: LIVE REAL-TIME SONAR SCAN */
          <>
            {/* Node 1 & 2: Sonar Waterfall & Preprocessing */}
            {activeTab === 'waterfall' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8">
                  <SonarWaterfallViewer
                    telemetry={telemetry}
                    targets={targets}
                    selectedTarget={selectedTarget}
                    onSelectTarget={(tgt) => setSelectedTarget(tgt)}
                    preprocessingParams={preprocessingParams}
                    setPreprocessingParams={setPreprocessingParams}
                    isLiveScanning={isLiveScanning}
                    setIsLiveScanning={setIsLiveScanning}
                    onExportReport={handleExportReport}
                  />
                </div>
                <div className="lg:col-span-4">
                  <TelemetryControlPanel
                    telemetry={telemetry}
                    setTelemetry={setTelemetry}
                    preprocessingParams={preprocessingParams}
                    setPreprocessingParams={setPreprocessingParams}
                    onResetDefaults={handleResetDefaults}
                    onCustomImageUploaded={handleCustomImageUploaded}
                    onLoadPreset={handleLoadPreset}
                  />
                </div>
              </div>
            )}

        {/* Nodes 3, 4, 5: Parallel Heads Inspector */}
        {activeTab === 'parallel_heads' && (
          <ParallelHeadsViewer
            telemetry={telemetry}
            selectedTarget={selectedTarget}
            onSelectTarget={(tgt) => setSelectedTarget(tgt)}
            targets={targets}
          />
        )}

        {/* Node 6: Temporal Ping Tracking */}
        {activeTab === 'temporal' && (
          <TemporalTrackerViewer
            telemetry={telemetry}
            targets={targets}
          />
        )}

        {/* Node 7: Acoustic Shadow Analysis Module */}
        {activeTab === 'shadow_analysis' && (
          <ShadowAnalysisViewer
            telemetry={telemetry}
            targets={targets}
            selectedTarget={selectedTarget}
            onSelectTarget={(tgt) => setSelectedTarget(tgt)}
            preprocessingParams={preprocessingParams}
            setPreprocessingParams={setPreprocessingParams}
          />
        )}

        {/* Node 8: RepDNet Physics Model */}
        {activeTab === 'physics3d' && (
          <PhysicsGeometryViewer
            telemetry={telemetry}
            targets={targets}
            selectedTarget={selectedTarget}
            onSelectTarget={(tgt) => setSelectedTarget(tgt)}
            minHeightThreshold={preprocessingParams.minHeightThreshold}
          />
        )}

        {/* Node 8: Geotagging Calculator */}
        {activeTab === 'geotag' && (
          <GeotaggingCalculator
            telemetry={telemetry}
            selectedTarget={selectedTarget}
          />
        )}

        {/* Node 9: Marine Geo-Risk Tactical Map */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <MarineRiskMap
                telemetry={telemetry}
                targets={targets}
                selectedTarget={selectedTarget}
                onSelectTarget={(tgt) => setSelectedTarget(tgt)}
              />
            </div>
            <div className="lg:col-span-4">
              <TelemetryControlPanel
                telemetry={telemetry}
                setTelemetry={setTelemetry}
                preprocessingParams={preprocessingParams}
                setPreprocessingParams={setPreprocessingParams}
                onResetDefaults={handleResetDefaults}
                onCustomImageUploaded={handleCustomImageUploaded}
                onLoadPreset={handleLoadPreset}
              />
            </div>
          </div>
        )}

        {/* Tab 7: Anomaly Reports & GeoTags */}
        {activeTab === 'reports' && (
          <AnomalyReportTable
            telemetry={telemetry}
            targets={targets}
            selectedTarget={selectedTarget}
            onSelectTarget={(tgt) => setSelectedTarget(tgt)}
          />
        )}

        {/* Tab 8: Python Codebase Hub */}
        {activeTab === 'code' && (
          <PythonCodeViewer />
        )}

        {/* System Architecture Flowchart Bar */}
        <section id="flowchart-architecture-bar" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                AQUAGHOST End-to-End Edge Architecture Flowchart
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              Click Any Node to Open Live View • Fusing Deterministic Acoustic Physics with GhostNetV2 AI
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-10 gap-2 text-center text-xs font-mono">
            {flowchartStages.map((stage) => (
              <div
                key={stage.num}
                onClick={() => setActiveTab(stage.tab)}
                className={`p-2 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  stage.highlight
                    ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300 font-bold shadow-sm hover:border-cyan-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="text-[10px] text-slate-500 mb-1">NODE {stage.num}</div>
                <div className="text-[11px] leading-tight line-clamp-2">{stage.label}</div>
              </div>
            ))}
          </div>
        </section>
        </>
      )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AQUAGHOST • Autonomous Marine Debris & Ghost Net Detection System</span>
          <span className="text-slate-400">
            NVIDIA Jetson Orin 15W Profile • OpenCV / NumPy / PyTorch Native
          </span>
        </div>
      </footer>
    </div>
  );
}
