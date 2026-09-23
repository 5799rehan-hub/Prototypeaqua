import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  Sliders, 
  Layers, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  GitMerge,
  Filter,
  Activity
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';
import { calculate3DHeight, calculateRepDNetPhysicsLoss } from '../utils/sonarAcousticMath';

interface PhysicsGeometryViewerProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
  minHeightThreshold: number;
}

export const PhysicsGeometryViewer: React.FC<PhysicsGeometryViewerProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
  minHeightThreshold,
}) => {
  // RepDNet Structural Re-parameterization visualization mode: Training (Multi-Branch) vs Edge Inference (Fused 3x3)
  const [reparamMode, setReparamMode] = useState<'training' | 'inference'>('inference');

  // Interactive simulation parameters
  const [altH, setAltH] = useState<number>(selectedTarget?.depthMeters ? telemetry.auvAltitudeH : 12.0);
  const [groundRg, setGroundRg] = useState<number>(selectedTarget ? selectedTarget.groundRangeRg : 18.5);
  const [shadowL, setShadowL] = useState<number>(selectedTarget ? selectedTarget.shadowLengthL : 6.8);
  const [eebGradient, setEebGradient] = useState<number>(selectedTarget?.repdnetEebEdgeGradient ?? 0.94);

  // Sync when user clicks another target
  const handleSelectTarget = (tgt: SonarTarget) => {
    onSelectTarget(tgt);
    setAltH(telemetry.auvAltitudeH);
    setGroundRg(tgt.groundRangeRg);
    setShadowL(tgt.shadowLengthL);
    setEebGradient(tgt.repdnetEebEdgeGradient ?? 0.85);
  };

  // Live calculation of 3D physical height & RepDNet physics loss
  const { heightH, sigmaH } = calculate3DHeight(altH, groundRg, shadowL);
  const shadowRatio = shadowL > 0.05 ? Math.min(1.0, shadowL / (groundRg * 0.4)) : 0.0;
  const { physicsLoss, consistencyScore } = calculateRepDNetPhysicsLoss(
    heightH,
    shadowL > 0.05 ? (altH * shadowL) / (groundRg + shadowL) : 0.0,
    shadowRatio,
    eebGradient
  );

  const repdnetPassed = heightH >= minHeightThreshold && shadowL > 0.05;
  const temporalPassed = (selectedTarget?.temporalHitStreak ?? 8) >= 3 && (selectedTarget?.temporalSpatialDriftM ?? 0.15) <= 0.40;
  const overallHazard = repdnetPassed && temporalPassed;

  // Slant range Rs = sqrt(Rg^2 + H^2)
  const slantRangeRs = Math.sqrt(groundRg * groundRg + altH * altH);

  // SVG Geometry normalization coordinates
  const SVG_WIDTH = 740;
  const SVG_HEIGHT = 340;
  const SEABED_Y = 270;

  const xScale = 18;
  const yScale = 9;

  const auvX = 70;
  const auvY = Math.max(40, SEABED_Y - altH * yScale);

  const objBaseX = Math.min(SVG_WIDTH - 200, auvX + groundRg * xScale);
  const visualHeightPx = Math.min(120, Math.max(4, heightH * yScale * 3.5));
  const objTopY = SEABED_Y - visualHeightPx;

  const visualShadowWidthPx = Math.min(260, Math.max(6, shadowL * xScale));
  const shadowEndX = objBaseX + visualShadowWidthPx;

  return (
    <div id="repdnet-physics-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      {/* Header and RepDNet Model Identity */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              FLOWCHART NODE 7
            </span>
            <span className="text-xs font-mono text-slate-400">
              RepDNet Physics-Informed Model • Structural Re-parameterization & Geometric Gating
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
            RepDNet Physics-Informed Model & 3D Shadow Geometric Validator
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-3xl leading-relaxed">
            RepDNet combines <strong className="text-cyan-300">Pixel Smoothing Blocks (PSB)</strong> and{' '}
            <strong className="text-purple-300">Edge Enhancement Blocks (EEB)</strong> with a{' '}
            <strong className="text-amber-300">Physics-Informed Geometric Loss</strong> ($L_{'{'}physics{'}'}$).
            During training, multi-branch directional priors lock onto shadow relief; during edge deployment,
            they re-parameterize into an ultra-fast single $3\times3$ convolution.
          </p>
        </div>

        {/* Target Preset Selector Buttons */}
        <div className="flex flex-wrap gap-2">
          {targets.map((tgt) => (
            <button
              key={tgt.id}
              onClick={() => handleSelectTarget(tgt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedTarget?.id === tgt.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-950/50'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              {tgt.status === 'CONFIRMED_HAZARD' ? (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
              ) : tgt.type === 'transient_clutter' ? (
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              )}
              <span>{tgt.name.split(' ')[0]}</span>
              <span className="text-[10px] opacity-75">
                ({tgt.status === 'CONFIRMED_HAZARD' ? 'Hazard' : tgt.type === 'transient_clutter' ? 'Transient' : 'Flat Rock'})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Structural Re-parameterization Architectural Interactive Showcase */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              RepDNet Structural Re-parameterization Architecture
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setReparamMode('training')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                reparamMode === 'training'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Training Mode: Multi-Branch Priors
            </button>
            <button
              onClick={() => setReparamMode('inference')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                reparamMode === 'inference'
                  ? 'bg-cyan-600 text-white font-bold shadow-sm shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Edge Inference: Fused 3×3 Conv (Jetson 15W)
            </button>
          </div>
        </div>

        {reparamMode === 'training' ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-900/90 border border-cyan-500/30">
              <div className="text-[10px] text-cyan-400 font-bold mb-1">BRANCH 1: PSB (Pixel Smoothing)</div>
              <div className="text-white font-semibold">Laplacian & Gaussian Filters</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Separates multiplicative Rayleigh speckle noise without blurring high-frequency net mesh filaments.
              </p>
              <div className="mt-2 text-[10px] text-emerald-300 font-bold">SNR Boost: +15.6 dB</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/90 border border-purple-500/30">
              <div className="text-[10px] text-purple-400 font-bold mb-1">BRANCH 2: EEB (Edge Enhancement)</div>
              <div className="text-white font-semibold">Directional Derivatives (Gx, Gy)</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Captures grazing acoustic shadow cutoffs and high-contrast specular highlight margins.
              </p>
              <div className="mt-2 text-[10px] text-purple-300 font-bold">Grad Magnitude: {eebGradient.toFixed(2)}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700">
              <div className="text-[10px] text-slate-400 font-bold mb-1">BRANCH 3: Identity & 1×1 Conv</div>
              <div className="text-white font-semibold">Cross-Channel Projection</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Preserves multi-frequency acoustic backscatter intensity dynamics across swath lines.
              </p>
              <div className="mt-2 text-[10px] text-sky-300 font-bold">Residual Path: Enabled</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/90 border border-amber-500/30">
              <div className="text-[10px] text-amber-400 font-bold mb-1">BRANCH 4: Standard 3×3 Conv</div>
              <div className="text-white font-semibold">Spatial Context Backbone</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Learns non-local textural patterns of synthetic monofilament nets vs sedimentary rippled beds.
              </p>
              <div className="mt-2 text-[10px] text-amber-300 font-bold">Receptive Field: 3×3 Grid</div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-slate-900 border border-cyan-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">
                  Collapsed Single 3×3 Convolution via Structural Re-parameterization
                </div>
                <div className="text-slate-400 text-[11px]">
                  $W_{'{'}fused{'}'} = W_{'{'}3\times3{'}'} + \text{'{'}pad{'}'}(W_{'{'}1\times1{'}'}) + W_{'{'}PSB{'}'} + W_{'{'}EEB{'}'}$ • Zero memory overhead, identical mathematical outputs.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-center shrink-0">
              <div className="px-3 py-1.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Jetson Latency</div>
                <div className="text-emerald-400 font-bold">17.1 ms (58.4 FPS)</div>
              </div>
              <div className="px-3 py-1.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Power Draw</div>
                <div className="text-cyan-400 font-bold">14.2 Watts</div>
              </div>
              <div className="px-3 py-1.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Edge Speedup</div>
                <div className="text-purple-400 font-bold">2.84× vs Multi-Branch</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Grid: Ray Tracing Seafloor Diagram + RepDNet Loss & Gate Decision */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: SVG Geometric Ray Diagram & Seabed Cross-Section (8 cols) */}
        <div className="lg:col-span-8 bg-slate-950 rounded-xl border border-slate-800 p-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2 px-1">
            <span>REPDNET PHYSICS-INFORMED RAY TRACE & SEABED SHADOW OCCLUSION</span>
            <span className="text-cyan-400">Acoustic Path: Transducer (Z=H) to Seabed (Z=0)</span>
          </div>

          <div className="w-full overflow-x-auto flex justify-center">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full max-w-[740px] h-auto select-none"
            >
              <defs>
                <linearGradient id="sonarRayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                </linearGradient>

                <pattern id="shadowHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#6366f1" strokeWidth="2" strokeOpacity="0.35" />
                </pattern>
              </defs>

              {/* Water Column Background */}
              <rect x="0" y="0" width={SVG_WIDTH} height={SEABED_Y} fill="#030812" />

              {/* Seafloor Bedrock/Sand (Bottom) */}
              <rect x="0" y={SEABED_Y} width={SVG_WIDTH} height={SVG_HEIGHT - SEABED_Y} fill="#1e180d" />
              <line x1="0" y1={SEABED_Y} x2={SVG_WIDTH} y2={SEABED_Y} stroke="#d97706" strokeWidth="2.5" />
              <text x="15" y={SEABED_Y + 25} fill="#b45309" fontSize="12" fontFamily="monospace" fontWeight="bold">
                SEABED DATUM (Z = 0)
              </text>

              {/* Shadow Zone (Occluded acoustic cone) */}
              <polygon
                points={`${objBaseX},${SEABED_Y} ${objBaseX},${objTopY} ${shadowEndX},${SEABED_Y}`}
                fill="url(#shadowHatch)"
                stroke="#818cf8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Sound Rays from AUV */}
              <line
                x1={auvX}
                y1={auvY}
                x2={shadowEndX}
                y2={SEABED_Y}
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              <line
                x1={auvX}
                y1={auvY}
                x2={objBaseX}
                y2={SEABED_Y}
                stroke="#38bdf8"
                strokeWidth="1.5"
                opacity="0.85"
              />

              {/* Towfish / AUV Icon & Coordinates */}
              <g transform={`translate(${auvX - 20}, ${auvY - 14})`}>
                <rect x="0" y="0" width="40" height="18" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                <polygon points="40,9 48,4 48,14" fill="#0284c7" />
                <circle cx="12" cy="9" r="3" fill="#facc15" />
                <text x="-15" y="-8" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  AUV Sonar Towfish
                </text>
              </g>

              {/* Altitude Dimension Line (H) */}
              <line x1="35" y1={auvY} x2="35" y2={SEABED_Y} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="30" y1={auvY} x2="40" y2={auvY} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="30" y1={SEABED_Y} x2="40" y2={SEABED_Y} stroke="#38bdf8" strokeWidth="1.5" />
              <text x="42" y={(auvY + SEABED_Y) / 2} fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">
                H = {altH.toFixed(1)}m
              </text>

              {/* Target Graphic */}
              {repdnetPassed ? (
                <g>
                  <rect
                    x={objBaseX - 6}
                    y={objTopY}
                    width="12"
                    height={visualHeightPx}
                    fill="rgba(244, 63, 94, 0.4)"
                    stroke="#f43f5e"
                    strokeWidth="2"
                  />
                  <line x1={objBaseX - 6} y1={objTopY + visualHeightPx * 0.3} x2={objBaseX + 6} y2={objTopY + visualHeightPx * 0.7} stroke="#f43f5e" strokeWidth="1" />
                  <line x1={objBaseX - 6} y1={objTopY + visualHeightPx * 0.7} x2={objBaseX + 6} y2={objTopY + visualHeightPx * 0.3} stroke="#f43f5e" strokeWidth="1" />
                  <circle cx={objBaseX} cy={objTopY} r="4" fill="#fbbf24" stroke="#f59e0b" />
                  <text x={objBaseX - 35} y={objTopY - 10} fill="#f43f5e" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    Ghost Net (3D Elevation)
                  </text>
                </g>
              ) : (
                <g>
                  <polygon
                    points={`${objBaseX - 16},${SEABED_Y} ${objBaseX + 16},${SEABED_Y} ${objBaseX + 10},${SEABED_Y - 6} ${objBaseX - 10},${SEABED_Y - 6}`}
                    fill="#64748b"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                  />
                  <text x={objBaseX - 25} y={SEABED_Y - 14} fill="#94a3b8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    Flat Rock (2D Relief)
                  </text>
                </g>
              )}

              {/* Physical Height Dimension (h) */}
              <line x1={objBaseX - 12} y1={objTopY} x2={objBaseX - 12} y2={SEABED_Y} stroke="#f43f5e" strokeWidth="1.5" />
              <line x1={objBaseX - 16} y1={objTopY} x2={objBaseX - 8} y2={objTopY} stroke="#f43f5e" strokeWidth="1.5" />
              <line x1={objBaseX - 16} y1={SEABED_Y} x2={objBaseX - 8} y2={SEABED_Y} stroke="#f43f5e" strokeWidth="1.5" />
              <text x={objBaseX - 60} y={(objTopY + SEABED_Y) / 2 + 4} fill="#f43f5e" fontSize="12" fontFamily="monospace" fontWeight="bold">
                h = {heightH.toFixed(2)}m
              </text>

              {/* Ground Range Rg */}
              <line x1={auvX} y1={SEABED_Y + 12} x2={objBaseX} y2={SEABED_Y + 12} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1={auvX} y1={SEABED_Y + 8} x2={auvX} y2={SEABED_Y + 16} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1={objBaseX} y1={SEABED_Y + 8} x2={objBaseX} y2={SEABED_Y + 16} stroke="#38bdf8" strokeWidth="1.5" />
              <text x={(auvX + objBaseX) / 2 - 25} y={SEABED_Y + 28} fill="#38bdf8" fontSize="11" fontFamily="monospace">
                R_g = {groundRg.toFixed(1)}m
              </text>

              {/* Shadow Length L */}
              <line x1={objBaseX} y1={SEABED_Y + 12} x2={shadowEndX} y2={SEABED_Y + 12} stroke="#818cf8" strokeWidth="1.5" />
              <line x1={shadowEndX} y1={SEABED_Y + 8} x2={shadowEndX} y2={SEABED_Y + 16} stroke="#818cf8" strokeWidth="1.5" />
              <text x={(objBaseX + shadowEndX) / 2 - 35} y={SEABED_Y + 28} fill="#818cf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                L_shd = {shadowL.toFixed(1)}m
              </text>

              <text x={(auvX + shadowEndX) / 2 - 20} y={(auvY + SEABED_Y) / 2 - 14} fill="#f59e0b" fontSize="11" fontFamily="monospace">
                R_s = {slantRangeRs.toFixed(1)}m
              </text>
            </svg>
          </div>

          {/* Interactive Calibration Sliders */}
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 font-mono mb-1">
                <span>Altitude (H):</span>
                <span className="text-cyan-400 font-bold">{altH.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="3.0"
                max="30.0"
                step="0.5"
                value={altH}
                onChange={(e) => setAltH(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-mono mb-1">
                <span>Ground Range (R_g):</span>
                <span className="text-sky-400 font-bold">{groundRg.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="5.0"
                max="45.0"
                step="0.5"
                value={groundRg}
                onChange={(e) => setGroundRg(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-mono mb-1">
                <span>Shadow Length (L):</span>
                <span className="text-indigo-400 font-bold">{shadowL.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="16.0"
                step="0.2"
                value={shadowL}
                onChange={(e) => setShadowL(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-mono mb-1">
                <span>EEB Edge Gradient:</span>
                <span className="text-purple-400 font-bold">{eebGradient.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.05"
                value={eebGradient}
                onChange={(e) => setEebGradient(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: RepDNet Physics Gate & Multi-Ping Temporal Check Decisions (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          {/* Dual Gate Status Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
              overallHazard
                ? 'bg-rose-950/40 border-rose-600/80 shadow-md shadow-rose-950/50'
                : 'bg-slate-800/60 border-slate-700 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                Pipeline Decision Status
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                  overallHazard
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-700 text-slate-300 border border-slate-600'
                }`}
              >
                {overallHazard ? 'CONFIRMED HAZARD' : 'REJECTED: FALSE POSITIVE'}
              </span>
            </div>

            <div className="flex items-center gap-3 my-1">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  overallHazard ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                {overallHazard ? (
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {overallHazard ? 'Confirmed Marine Hazard' : 'Filtered Non-Hazard'}
                </h3>
                <p className="text-xs text-slate-400">
                  {overallHazard
                    ? 'Ghost net / Entangled trawler gear'
                    : !repdnetPassed
                    ? 'Flat geological bedrock / sand ripple'
                    : 'Transient water column noise'}
                </p>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="text-xs border-t border-slate-700/60 pt-2 font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-400">
                  {repdnetPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>1. RepDNet Physics Gate:</span>
                </span>
                <span className={repdnetPassed ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                  {repdnetPassed ? `Passed (h=${heightH.toFixed(2)}m)` : `Failed (h < ${minHeightThreshold}m)`}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-400">
                  {temporalPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>2. Temporal Check Gate:</span>
                </span>
                <span className={temporalPassed ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                  {temporalPassed
                    ? `Passed (${selectedTarget?.temporalHitStreak ?? 8} hits)`
                    : `Failed (${selectedTarget?.temporalHitStreak ?? 1} hit)`}
                </span>
              </div>
            </div>
          </div>

          {/* RepDNet Physics-Informed Formulation & Geometric Loss Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-cyan-400 font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>RepDNet Physics-Informed Loss</span>
              </h4>
              <span className="text-[10px] text-slate-400">
                Score: <strong className="text-cyan-300">{consistencyScore}%</strong>
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-center">
              <div className="text-xs font-bold text-cyan-300 tracking-wide">
                L_physics = |h_pred - (H·L)/(R_g + L)| + λ·(1 - G_eeb)
              </div>
            </div>

            <div className="space-y-1.5 text-slate-300 text-[11px] pt-1">
              <div className="flex justify-between">
                <span>Calculated Height h:</span>
                <span className="text-rose-400 font-bold">{heightH.toFixed(3)} m</span>
              </div>
              <div className="flex justify-between">
                <span>Uncertainty (±1σ):</span>
                <span className="text-slate-400 font-semibold">±{sigmaH.toFixed(3)} m</span>
              </div>
              <div className="flex justify-between">
                <span>RepDNet Physics Loss:</span>
                <span className={`font-bold ${physicsLoss < 0.15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {physicsLoss.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>EEB Edge Gradient:</span>
                <span className="text-purple-300 font-semibold">{(eebGradient * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Temporal Drift:</span>
                <span className="text-sky-300 font-semibold">{selectedTarget?.temporalSpatialDriftM.toFixed(2) || '0.12'} m</span>
              </div>
            </div>

            <div className="mt-2 p-2 rounded bg-slate-900 text-[10px] text-slate-400 leading-relaxed border border-slate-800/80">
              <span className="text-cyan-400 font-semibold">Physics-Informed Guarantee:</span> RepDNet enforces
              physical consistency between echo highlight backscatter, acoustic shadow occlusion, and multi-ping temporal
              stationarity. Transient fish and flat rocks are mathematically excluded.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
