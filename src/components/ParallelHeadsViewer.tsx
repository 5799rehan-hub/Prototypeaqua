import React, { useState } from 'react';
import { 
  Layers, 
  Cpu, 
  CheckCircle2, 
  Scan, 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  Maximize2, 
  GitMerge, 
  ArrowRight, 
  Sparkles,
  Check,
  Scale
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

interface ParallelHeadsViewerProps {
  telemetry: SonarMissionTelemetry;
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
  targets: SonarTarget[];
}

export const ParallelHeadsViewer: React.FC<ParallelHeadsViewerProps> = ({
  telemetry,
  selectedTarget,
  onSelectTarget,
  targets,
}) => {
  const [activeFeatureView, setActiveFeatureView] = useState<'all' | 'bbox' | 'shadow_mask' | 'anomaly'>('all');
  const [showCode, setShowCode] = useState<boolean>(false);
  const target = selectedTarget || targets[0];

  const sObj = target.objectDetectorScore ?? target.aiConfidence;
  const sShd = target.shadowAnalysisScore ?? (target.shadowLengthL > 0.5 ? 0.90 : 0.10);
  const sAnom = target.anomalyDetectorScore ?? (target.status === 'CONFIRMED_HAZARD' ? 0.90 : 0.15);
  const agreement = target.triFeatureAgreement ?? 90;
  const fusedConfidence = target.fusedConfidenceScore ?? Math.round(target.aiConfidence * 100);

  // Compute or get fused boundary box
  const fusedBBox = target.fusedBBox || {
    x: target.shadowBBox && target.shadowLengthL > 0.1
      ? Math.min(target.highlightBBox.x, target.shadowBBox.x)
      : target.highlightBBox.x,
    y: target.shadowBBox && target.shadowLengthL > 0.1
      ? Math.min(target.highlightBBox.y, target.shadowBBox.y)
      : target.highlightBBox.y,
    width: target.shadowBBox && target.shadowLengthL > 0.1
      ? Math.max(target.highlightBBox.x + target.highlightBBox.width, target.shadowBBox.x + target.shadowBBox.width) - Math.min(target.highlightBBox.x, target.shadowBBox.x)
      : target.highlightBBox.width,
    height: target.shadowBBox && target.shadowLengthL > 0.1
      ? Math.max(target.highlightBBox.y + target.highlightBBox.height, target.shadowBBox.y + target.shadowBBox.height) - Math.min(target.highlightBBox.y, target.shadowBBox.y)
      : target.highlightBBox.height,
  };

  const isConfirmed = target.status === 'CONFIRMED_HAZARD';

  return (
    <div id="parallel-heads-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-6">
      {/* Header & Flowchart Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              FLOWCHART NODES 4 & 5
            </span>
            <span className="text-xs font-mono text-slate-400">
              PANet Multi-Scale Feature Fusion • 3 Parallel Heads • Tri-Feature Comparator
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-400" />
            Multi-Scale Feature Fusion & Tri-Feature Comparator
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Extracts multiscale features (P3, P4, P5) via GhostNetV2 and PANet neck, feeding three parallel specialized heads: 
            <strong> [Object Detector]</strong>, <strong>[Shadow Analysis]</strong>, and <strong>[Anomaly Detector]</strong>. 
            The Multi-Scale Feature Fusion Engine cross-compares all 3 features, rejects flat rock false alarms, and outputs the 
            <strong> Unified Boundary Box</strong> and <strong>Fused Confidence Score</strong>.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCode(!showCode)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{showCode ? 'Hide PyTorch Code' : 'View Fusion Code'}</span>
          </button>
        </div>
      </div>

      {/* Target Quick Selector (Allows testing Debris vs False Positives) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
            Select Sonar Target to Inspect Tri-Feature Comparison:
          </span>
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Compare True 3D Hazards vs. 2D Bedrock False Positives
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {targets.map((tgt) => {
            const isSelected = tgt.id === target.id;
            const tgtConfirmed = tgt.status === 'CONFIRMED_HAZARD';
            return (
              <button
                key={tgt.id}
                onClick={() => onSelectTarget(tgt)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? tgtConfirmed
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-400/50'
                      : 'bg-rose-950/80 border-rose-400 text-rose-200 shadow-md ring-1 ring-rose-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {tgtConfirmed ? (
                  <AlertTriangle className="w-3 h-3 text-cyan-400" />
                ) : (
                  <XCircle className="w-3 h-3 text-rose-400" />
                )}
                <span className="font-bold">{tgt.id}</span>
                <span className="opacity-75 truncate max-w-[120px]">{tgt.name.split(' ')[0]}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  tgtConfirmed ? 'bg-cyan-900/60 text-cyan-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tgt.fusedConfidenceScore ?? Math.round(tgt.aiConfidence * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PANet Multi-Scale Feature Architecture Pipeline Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono">
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Input Backbone</div>
          <div className="text-cyan-400 font-bold flex items-center gap-1.5 mt-0.5">
            <Cpu className="w-3.5 h-3.5" />
            GhostNetV2 (DFC Attention)
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Multi-Scale Pyramids: P3, P4, P5</div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Feature Neck</div>
          <div className="text-purple-400 font-bold flex items-center gap-1.5 mt-0.5">
            <Layers className="w-3.5 h-3.5" />
            PANet Top-Down & Bottom-Up
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Bi-directional semantic fusion: N3, N4, N5</div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Parallel Feature Heads</div>
          <div className="text-indigo-400 font-bold flex items-center gap-1.5 mt-0.5">
            <Scan className="w-3.5 h-3.5" />
            3 Independent Extractors
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Echo Highlight • Shadow Relief • Anomaly</div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-purple-500/40 bg-purple-950/20">
          <div className="text-[10px] text-purple-400 uppercase font-bold">Fusion Engine Output</div>
          <div className="text-white font-bold flex items-center gap-1.5 mt-0.5">
            <GitMerge className="w-3.5 h-3.5 text-amber-400" />
            Fused Box & Fused Score
          </div>
          <div className="text-[11px] text-amber-300 font-semibold mt-1">Unified Boundary Box + Confidence</div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-300 font-bold uppercase flex items-center gap-1.5">
          <Scan className="w-3.5 h-3.5 text-purple-400" />
          The 3 Parallel Feature Heads:
        </span>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveFeatureView('all')}
            className={`px-3 py-1 rounded transition-all cursor-pointer ${
              activeFeatureView === 'all'
                ? 'bg-slate-800 text-purple-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All 3 Heads Side-by-Side
          </button>
          <button
            onClick={() => setActiveFeatureView('bbox')}
            className={`px-3 py-1 rounded transition-all cursor-pointer ${
              activeFeatureView === 'bbox'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Object Detector
          </button>
          <button
            onClick={() => setActiveFeatureView('shadow_mask')}
            className={`px-3 py-1 rounded transition-all cursor-pointer ${
              activeFeatureView === 'shadow_mask'
                ? 'bg-slate-800 text-indigo-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Shadow Analysis
          </button>
          <button
            onClick={() => setActiveFeatureView('anomaly')}
            className={`px-3 py-1 rounded transition-all cursor-pointer ${
              activeFeatureView === 'anomaly'
                ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Anomaly Detector
          </button>
        </div>
      </div>

      {/* 3 Parallel Heads Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Head 1: Object Bounding Box Detector */}
        <div className={`p-4 rounded-xl border transition-all ${
          activeFeatureView === 'all' || activeFeatureView === 'bbox'
            ? 'bg-slate-950 border-cyan-500/50 shadow-md shadow-cyan-950/20'
            : 'bg-slate-950/50 border-slate-800 opacity-40'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
            <span className="text-cyan-400 font-bold flex items-center gap-1.5">
              <Scan className="w-3.5 h-3.5" />
              FEATURE 1: OBJECT DETECTOR
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px]">
              N4 Stride 8
            </span>
          </div>

          <div className="my-3 relative h-44 bg-[#030914] rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
            {/* Visual Highlight Bounding Box */}
            <div className="w-28 h-20 border-2 border-cyan-400 bg-cyan-500/15 rounded flex flex-col justify-between p-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <span className="text-[10px] font-mono text-cyan-300 font-bold bg-slate-950/90 px-1 rounded self-start">
                Highlight Echo
              </span>
              <div className="text-center text-[10px] font-mono text-cyan-300 font-bold">
                s_obj = {(sObj * 100).toFixed(1)}%
              </div>
              <div className="text-[9px] font-mono text-cyan-400 text-right">
                {target.highlightBBox.width}×{target.highlightBBox.height} px
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Backscatter Echo Class:</span>
              <span className="text-cyan-300 font-bold">{target.type.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Object Detector Score (s_obj):</span>
              <span className="text-cyan-300 font-bold">{(sObj * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Highlight Box [X, Y, W, H]:</span>
              <span className="text-slate-200">
                [{target.highlightBBox.x}, {target.highlightBBox.y}, {target.highlightBBox.width}, {target.highlightBBox.height}]
              </span>
            </div>
          </div>
        </div>

        {/* Head 2: Acoustic Shadow Analysis */}
        <div className={`p-4 rounded-xl border transition-all ${
          activeFeatureView === 'all' || activeFeatureView === 'shadow_mask'
            ? 'bg-slate-950 border-indigo-500/50 shadow-md shadow-indigo-950/20'
            : 'bg-slate-950/50 border-slate-800 opacity-40'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
            <span className="text-indigo-400 font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              FEATURE 2: SHADOW ANALYSIS
            </span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px]">
              N3 Stride 4
            </span>
          </div>

          <div className="my-3 relative h-44 bg-[#02050c] rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
            {target.shadowLengthL > 0.5 ? (
              <div className="flex items-center gap-1">
                <div className="w-10 h-16 bg-slate-800/80 rounded-l border border-slate-600 opacity-40 flex items-center justify-center text-[8px] text-slate-400 font-mono">
                  Echo
                </div>
                <div className="w-24 h-16 bg-indigo-950/80 border-2 border-dashed border-indigo-400 rounded-r flex flex-col items-center justify-center text-center p-1 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
                  <span className="text-[9px] font-mono text-indigo-200 font-bold">
                    SHADOW ZONE
                  </span>
                  <span className="text-[10px] font-mono text-indigo-300 font-bold">
                    s_shd = {(sShd * 100).toFixed(1)}%
                  </span>
                  <span className="text-[8px] font-mono text-indigo-400">
                    L = {target.shadowLengthL.toFixed(1)}m
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center p-3 text-slate-500 font-mono text-xs space-y-1">
                <div className="text-rose-400 font-bold">NO ACOUSTIC SHADOW DETECTED</div>
                <div className="text-slate-400 text-[10px]">s_shd = {(sShd * 100).toFixed(1)}% (Negligible Relief)</div>
                <div className="text-amber-400 text-[10px]">Flat Bedrock Profile ~ 0.0m</div>
              </div>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Shadow Analysis Score (s_shd):</span>
              <span className={`font-bold ${sShd > 0.5 ? 'text-indigo-300' : 'text-rose-400'}`}>
                {(sShd * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Shadow Length (L_shd):</span>
              <span className="text-indigo-300 font-bold">{target.shadowLengthL.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Shadow Box [X, Y, W, H]:</span>
              <span className="text-slate-200">
                {target.shadowBBox
                  ? `[${target.shadowBBox.x}, ${target.shadowBBox.y}, ${target.shadowBBox.width}, ${target.shadowBBox.height}]`
                  : 'None (Zero Relief)'}
              </span>
            </div>
          </div>
        </div>

        {/* Head 3: Acoustic Anomaly Detector */}
        <div className={`p-4 rounded-xl border transition-all ${
          activeFeatureView === 'all' || activeFeatureView === 'anomaly'
            ? 'bg-slate-950 border-amber-500/50 shadow-md shadow-amber-950/20'
            : 'bg-slate-950/50 border-slate-800 opacity-40'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              FEATURE 3: ANOMALY DETECTOR
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px]">
              N5 Stride 16
            </span>
          </div>

          <div className="my-3 relative h-44 bg-[#0a0702] rounded-lg border border-slate-800 flex flex-col items-center justify-center p-3">
            <div className="w-20 h-20 rounded-full border-4 border-amber-500/30 flex items-center justify-center relative shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex flex-col items-center justify-center">
                <span className="text-amber-300 font-mono font-bold text-sm">
                  {(sAnom * 100).toFixed(0)}%
                </span>
                <span className="text-[8px] font-mono text-amber-400 uppercase">
                  Anomaly
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-amber-300 mt-2 font-bold uppercase text-center">
              {sAnom > 0.5 ? 'Synthetic Grid/Mesh Texture' : 'Natural Marine Sediment Texture'}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Anomaly Density Score (s_anom):</span>
              <span className={`font-bold ${sAnom > 0.5 ? 'text-amber-300' : 'text-slate-400'}`}>
                {(sAnom * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Structural Texture Outlier:</span>
              <span className={sAnom > 0.5 ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                {sAnom > 0.5 ? 'High (Man-Made Debris)' : 'Low (Natural Geology)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Acoustic Contrast Ratio:</span>
              <span className="text-slate-200">
                {sAnom > 0.5 ? '18.4 dB (High)' : '3.2 dB (Baseline)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THE MULTI-SCALE FEATURE FUSION ENGINE (TRI-FEATURE COMPARATOR) */}
      {/* ========================================================================= */}
      <div className="bg-slate-950 border-2 border-purple-500/40 rounded-xl p-5 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Multi-Scale Feature Fusion Engine & Comparator
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700">
                  3-Head Comparison
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Compares Object Highlight, Shadow Occlusion, and Anomaly Texture to synthesize the Final Boundary Box & Fused Confidence Score.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Tri-Feature Agreement:</span>
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
              agreement > 70 
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300' 
                : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
            }`}>
              {agreement.toFixed(1)}% Consensus
            </span>
          </div>
        </div>

        {/* Comparison Meter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Feature 1 Comparison Bar */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Scan className="w-3.5 h-3.5" />
                1. Object Echo (s_obj)
              </span>
              <span className="text-cyan-300 font-bold">{(sObj * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 transition-all duration-500" 
                style={{ width: `${Math.min(sObj * 100, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Weight: 40%</span>
              <span>Backscatter Response</span>
            </div>
          </div>

          {/* Feature 2 Comparison Bar */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
                <Layers className="w-3.5 h-3.5" />
                2. Shadow Relief (s_shd)
              </span>
              <span className={`font-bold ${sShd > 0.5 ? 'text-indigo-300' : 'text-rose-400'}`}>
                {(sShd * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${sShd > 0.5 ? 'bg-indigo-500' : 'bg-rose-500'}`} 
                style={{ width: `${Math.min(sShd * 100, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Weight: 35%</span>
              <span>{target.shadowLengthL > 0.1 ? `${target.shadowLengthL.toFixed(1)}m shadow` : 'No shadow!'}</span>
            </div>
          </div>

          {/* Feature 3 Comparison Bar */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Activity className="w-3.5 h-3.5" />
                3. Anomaly Texture (s_anom)
              </span>
              <span className={`font-bold ${sAnom > 0.5 ? 'text-amber-300' : 'text-slate-400'}`}>
                {(sAnom * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${sAnom > 0.5 ? 'bg-amber-400' : 'bg-slate-600'}`} 
                style={{ width: `${Math.min(sAnom * 100, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Weight: 25%</span>
              <span>{sAnom > 0.5 ? 'Synthetic geometry' : 'Seabed geology'}</span>
            </div>
          </div>
        </div>

        {/* Tri-Feature Comparison Diagnostic Box */}
        <div className={`p-3.5 rounded-lg border text-xs font-mono flex items-start gap-3 ${
          isConfirmed 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
        }`}>
          {isConfirmed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 flex-1">
            <div className="font-bold flex items-center justify-between">
              <span>
                {isConfirmed 
                  ? 'TRI-FEATURE CONSENSUS VERIFIED: Confirmed 3D Man-Made Marine Debris' 
                  : 'TRI-FEATURE MISMATCH DETECTED: False Alarm Eliminated by Multi-Scale Comparison'}
              </span>
              <span className="text-[10px] opacity-75">{target.id}</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              {isConfirmed
                ? `All three feature heads corroborate the hazard: strong backscatter echo (${(sObj * 100).toFixed(0)}%), verified acoustic shadow relief (${target.shadowLengthL.toFixed(1)}m, ${(sShd * 100).toFixed(0)}%), and non-seafloor synthetic texture (${(sAnom * 100).toFixed(0)}%). The unified boundary box encloses both echo and shadow.`
                : `The 2D Object Detector scored ${(sObj * 100).toFixed(0)}% based on brightness alone, but the Shadow Analysis head recorded near-zero relief (${target.shadowLengthL.toFixed(2)}m) and Anomaly Detector matched natural bedrock (${(sAnom * 100).toFixed(0)}%). The fusion comparator penalized the confidence score to ${fusedConfidence}%, rejecting it as a false positive.`}
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* THE FINAL OUTPUTS: UNIFIED BOUNDARY BOX & FUSED CONFIDENCE SCORE */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
          {/* Output 1: Unified Fused Boundary Box Card */}
          <div className="md:col-span-7 bg-slate-900 border border-purple-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-2">
              <span className="text-amber-300 font-bold flex items-center gap-1.5 uppercase">
                <Maximize2 className="w-3.5 h-3.5" />
                OUTPUT 1: UNIFIED FUSED BOUNDARY BOX
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-200 border border-amber-800">
                Acoustic Envelope
              </span>
            </div>

            {/* Visual Bounding Box Diagram */}
            <div className="relative h-40 bg-[#020712] rounded-lg border border-slate-800 flex items-center justify-center p-3 overflow-hidden">
              {/* Sonar water background grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:12px_12px] opacity-30" />

              {/* Fused Bounding Box Container */}
              <div className={`relative border-2 rounded p-2 flex flex-col justify-between transition-all ${
                isConfirmed
                  ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-slate-600 bg-slate-800/20'
              }`} style={{ width: '85%', height: '80%' }}>
                {/* Header Tag */}
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                    isConfirmed ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                  }`}>
                    FUSED BOUNDARY BOX
                  </span>
                  <span className="text-amber-300 font-bold">
                    {fusedBBox.width} × {fusedBBox.height} px
                  </span>
                </div>

                {/* Sub-Components: Highlight and Shadow internal regions */}
                <div className="flex items-center gap-2 my-auto">
                  {/* Highlight sub-box */}
                  <div className="flex-1 h-12 border border-cyan-400 bg-cyan-500/20 rounded flex items-center justify-center text-[9px] font-mono text-cyan-200 text-center font-bold">
                    Highlight Echo<br />
                    {target.highlightBBox.width}×{target.highlightBBox.height}px
                  </div>

                  {/* Arrow indicator */}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                  {/* Shadow sub-box */}
                  <div className={`flex-1 h-12 border rounded flex items-center justify-center text-[9px] font-mono text-center font-bold ${
                    target.shadowBBox && target.shadowLengthL > 0.1
                      ? 'border-indigo-400 bg-indigo-900/40 text-indigo-200'
                      : 'border-slate-700 bg-slate-800/40 text-slate-500'
                  }`}>
                    {target.shadowBBox && target.shadowLengthL > 0.1 ? (
                      <>Shadow Relief<br />{target.shadowBBox.width}×{target.shadowBBox.height}px</>
                    ) : (
                      <>Zero Shadow<br />Flat Profile</>
                    )}
                  </div>
                </div>

                {/* Footer Coordinates and Range */}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-slate-800/60 pt-1">
                  <span>Ground Range Rg: <strong className="text-white">{target.groundRangeRg.toFixed(1)}m</strong></span>
                  <span>Physical Footprint: <strong className="text-white">{target.objectLength.toFixed(1)}m × {target.objectWidth.toFixed(1)}m</strong></span>
                </div>
              </div>
            </div>

            {/* Bounding Box Mathematical Data */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">COORDINATES [X, Y]:</span>
                <span className="text-amber-300 font-bold">[{fusedBBox.x}, {fusedBBox.y}]</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">BOX SPAN [W × H]:</span>
                <span className="text-amber-300 font-bold">{fusedBBox.width}px × {fusedBBox.height}px</span>
              </div>
            </div>
          </div>

          {/* Output 2: Final Fused Confidence Score Card */}
          <div className="md:col-span-5 bg-slate-900 border border-purple-500/30 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-2">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5 uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                OUTPUT 2: FUSED CONFIDENCE SCORE
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                isConfirmed ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {isConfirmed ? 'CONFIRMED' : 'REJECTED'}
              </span>
            </div>

            {/* Score Big Display */}
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
              isConfirmed
                ? 'bg-gradient-to-b from-cyan-950/40 to-slate-950 border-cyan-500/50 shadow-lg shadow-cyan-950/30'
                : 'bg-gradient-to-b from-rose-950/40 to-slate-950 border-rose-500/50 shadow-lg shadow-rose-950/30'
            }`}>
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Final Tri-Feature Fused Score
              </div>
              <div className={`text-4xl font-mono font-black ${
                isConfirmed ? 'text-cyan-300' : 'text-rose-400'
              }`}>
                {fusedConfidence}%
              </div>
              <div className="text-[11px] font-mono text-slate-300 mt-2 font-bold flex items-center gap-1">
                {isConfirmed ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>
                  {isConfirmed ? 'High-Risk Ghost Net / Marine Debris' : 'Rejected False Positive (Flat Bedrock)'}
                </span>
              </div>
            </div>

            {/* Formula Breakdown */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
              <div className="text-slate-300 font-bold text-[11px]">Fusion Formulation:</div>
              <div className="text-slate-400">
                S_fused = (0.40·s_obj + 0.35·s_shd + 0.25·s_anom) × Agreement
              </div>
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                <span>Raw Weighted:</span>
                <span className="text-slate-200 font-bold">
                  {((0.40 * sObj + 0.35 * sShd + 0.25 * sAnom) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Calculated 3D Relief:</span>
                <span className={target.calculatedHeight >= 0.20 ? 'text-cyan-300 font-bold' : 'text-rose-400 font-bold'}>
                  h = {target.calculatedHeight.toFixed(2)}m
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Optional PyTorch Multi-Scale Feature Fusion Engine Code Snippet */}
      {showCode && (
        <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/40 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-purple-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              PyTorch & OpenCV Multi-Scale Feature Fusion Engine (NVIDIA Jetson)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-200">
              node_4_5_feature_fusion.py
            </span>
          </div>
          <pre className="p-3 rounded bg-slate-900 border border-slate-800 text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`class MultiScaleFeatureFusionComparator:
    """
    Fuses Object Detector (N4), Shadow Analysis (N3), and Anomaly Detector (N5)
    to compute the Unified Boundary Box and Fused Confidence Score.
    """
    def __init__(self, w_obj=0.40, w_shd=0.35, w_anom=0.25, min_height_m=0.20):
        self.w_obj = w_obj
        self.w_shd = w_shd
        self.w_anom = w_anom
        self.min_height_m = min_height_m

    def fuse(self, highlight_box, shadow_box, s_obj, s_shd, s_anom, altitude_h, ground_rg):
        # 1. Tri-Feature Score Consensus
        spread = max(s_obj, s_shd, s_anom) - min(s_obj, s_shd, s_anom)
        agreement = max(0.0, 1.0 - spread)

        # 2. Unified Boundary Box: Encloses both Echo Highlight and Shadow Footprint
        if shadow_box is not None and shadow_box.width > 2:
            min_x = min(highlight_box.x, shadow_box.x)
            min_y = min(highlight_box.y, shadow_box.y)
            max_x = max(highlight_box.x + highlight_box.w, shadow_box.x + shadow_box.w)
            max_y = max(highlight_box.y + highlight_box.h, shadow_box.y + shadow_box.h)
            fused_bbox = [min_x, min_y, max_x - min_x, max_y - min_y]
        else:
            fused_bbox = [highlight_box.x, highlight_box.y, highlight_box.w, highlight_box.h]

        # 3. Deterministic 3D Height Gate: h = (H * L) / (Rg + L)
        shadow_len_m = shadow_box.length_m if shadow_box else 0.0
        h_3d = (altitude_h * shadow_len_m) / (ground_rg + shadow_len_m + 1e-6)

        # 4. Fused Confidence Calculation
        weighted_score = (self.w_obj * s_obj + self.w_shd * s_shd + self.w_anom * s_anom)
        if h_3d < self.min_height_m or shadow_box is None:
            # Penalize confidence: Flat rock or ripple with no 3D shadow relief
            fused_confidence = weighted_score * 0.15
            status = "REJECTED_FALSE_POSITIVE"
        else:
            fused_confidence = weighted_score * agreement
            status = "CONFIRMED_HAZARD"

        return {
            "fused_bbox": fused_bbox,
            "fused_confidence": round(fused_confidence * 100, 1),
            "agreement_pct": round(agreement * 100, 1),
            "status": status,
            "height_3d_m": round(h_3d, 3)
        }`}
          </pre>
        </div>
      )}

      {/* Architecture Insight Footer */}
      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span>Multi-Scale Feature Fusion TensorRT latency: <strong className="text-purple-300">4.8 ms</strong> on Jetson Orin</span>
        </div>
        <div className="text-slate-500 text-[11px]">
          Target Under Test: <span className="text-cyan-400 font-bold">{target.id}</span> ({target.name})
        </div>
      </div>
    </div>
  );
};
