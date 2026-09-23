import React, { useState, useMemo } from 'react';
import {
  Eye,
  Sliders,
  Maximize2,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Activity,
  Layers,
  FileCode,
  Download,
  Info,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Compass,
  ArrowRight,
  TrendingDown,
  Scale,
  Zap,
  Copy,
  Check
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry, PreprocessingParams } from '../types/sonar';
import { generateCrossTrackShadowProfile, ShadowProfilePoint } from '../utils/sonarAcousticMath';

interface ShadowAnalysisViewerProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
  preprocessingParams: PreprocessingParams;
  setPreprocessingParams: React.Dispatch<React.SetStateAction<PreprocessingParams>>;
}

export const ShadowAnalysisViewer: React.FC<ShadowAnalysisViewerProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
  preprocessingParams,
  setPreprocessingParams,
}) => {
  const activeTarget = selectedTarget || targets[0];

  // Interactive live simulation sliders for the active target
  const [altH, setAltH] = useState<number>(telemetry.auvAltitudeH);
  const [groundRg, setGroundRg] = useState<number>(activeTarget.groundRangeRg);
  const [shadowL, setShadowL] = useState<number>(activeTarget.shadowLengthL);
  const [minContrastDb, setMinContrastDb] = useState<number>(preprocessingParams.minShadowContrastDb ?? 12.0);
  const [minShadowLen, setMinShadowLen] = useState<number>(preprocessingParams.minShadowLengthThreshold ?? 0.50);
  const [minHeight, setMinHeight] = useState<number>(preprocessingParams.minHeightThreshold ?? 0.20);
  const [seabedSlopeDeg, setSeabedSlopeDeg] = useState<number>(0);
  const [activeApertureTab, setActiveApertureTab] = useState<'raw' | 'mask' | 'gradient'>('raw');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showPythonDrawer, setShowPythonDrawer] = useState<boolean>(false);
  const [hoveredProfilePoint, setHoveredProfilePoint] = useState<ShadowProfilePoint | null>(null);

  // Synchronize when target changes
  const handleSelectTarget = (target: SonarTarget) => {
    onSelectTarget(target);
    setAltH(telemetry.auvAltitudeH);
    setGroundRg(target.groundRangeRg);
    setShadowL(target.shadowLengthL);
  };

  // Re-calculate cross-track profile and geometric height
  const profileData = useMemo(() => {
    const calculatedHeight = (altH * shadowL) / Math.max(0.1, groundRg + shadowL);
    return generateCrossTrackShadowProfile(
      altH,
      groundRg,
      shadowL,
      calculatedHeight,
      activeTarget.type,
      64
    );
  }, [altH, groundRg, shadowL, activeTarget.type]);

  const { points, summary } = profileData;

  // Custom gate check with interactive thresholds
  const isShadowLengthPass = shadowL >= minShadowLen;
  const isContrastPass = summary.extinctionContrastDb >= minContrastDb;
  const isHeightPass = summary.calculatedHeightM >= minHeight;
  const isGateConfirmed = shadowL > 0.05 && isShadowLengthPass && isContrastPass && isHeightPass;

  // SVG ray-casting visualization coordinates
  const svgWidth = 720;
  const svgHeight = 280;
  const margin = { top: 35, right: 40, bottom: 45, left: 60 };

  const plotW = svgWidth - margin.left - margin.right;
  const plotH = svgHeight - margin.top - margin.bottom;

  // Sonar transducer position at top left
  const txX = margin.left + 30;
  const txY = margin.top + 20;

  // Seabed line position
  const seabedY = margin.top + plotH - 10;
  const targetX = txX + (groundRg / 45.0) * (plotW - 140);
  const shadowEndNorm = Math.min(1.0, (groundRg + shadowL) / 45.0);
  const shadowEndX = txX + shadowEndNorm * (plotW - 140);

  // Scaled target height on screen
  const targetScale = 38; // px per meter
  const targetHeightPx = Math.max(3, summary.calculatedHeightM * targetScale);
  const targetApexY = seabedY - targetHeightPx;

  // Intensity Profile SVG dimensions
  const chartWidth = 720;
  const chartHeight = 220;
  const chartMargin = { top: 25, right: 30, bottom: 40, left: 60 };
  const chartPlotW = chartWidth - chartMargin.left - chartMargin.right;
  const chartPlotH = chartHeight - chartMargin.top - chartMargin.bottom;

  const minRange = points[0]?.rangeMeters ?? 0;
  const maxRange = points[points.length - 1]?.rangeMeters ?? 50;
  const rangeSpan = Math.max(1, maxRange - minRange);

  // dB scale from -45 dB to 5 dB
  const minDb = -45;
  const maxDb = 5;
  const dbSpan = maxDb - minDb;

  const getChartX = (r: number) => chartMargin.left + ((r - minRange) / rangeSpan) * chartPlotW;
  const getChartY = (db: number) => chartMargin.top + chartPlotH - ((db - minDb) / dbSpan) * chartPlotH;

  // Create path for intensity profile
  const profilePathD = points.reduce((acc, pt, idx) => {
    const x = getChartX(pt.rangeMeters);
    const y = getChartY(pt.intensityDb);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Fill area under shadow void
  const shadowPoints = points.filter((p) => p.region === 'shadow_void' || p.region === 'shadow_drop');
  const shadowFillD = shadowPoints.length > 1
    ? `M ${getChartX(shadowPoints[0].rangeMeters)} ${getChartY(minDb)} ` +
      shadowPoints.map((p) => `L ${getChartX(p.rangeMeters)} ${getChartY(p.intensityDb)}`).join(' ') +
      ` L ${getChartX(shadowPoints[shadowPoints.length - 1].rangeMeters)} ${getChartY(minDb)} Z`
    : '';

  const handleCopyPython = () => {
    const pyCode = `# AQUAGHOST Acoustic Shadow Analyzer (Standalone NVIDIA Jetson Script)
from acoustic_shadow_analyzer import AcousticShadowAnalyzer

analyzer = AcousticShadowAnalyzer(min_shadow_length_m=${minShadowLen}, min_contrast_db=${minContrastDb}, min_height_m=${minHeight})
report = analyzer.analyze_target_shadow(
    target_id="${activeTarget.id}",
    target_name="${activeTarget.name}",
    target_type="${activeTarget.type}",
    altitude_h=${altH},
    ground_range_rg=${groundRg},
    shadow_length_l=${shadowL},
    measured_contrast_db=${summary.extinctionContrastDb}
)
print("Acoustic Shadow Gate:", report.status)
print("3D Height (h):", report.calculated_height_m, "meters ±", report.height_uncertainty_m)
print("Contrast:", report.extinction_contrast_db, "dB | Morphology:", report.shadow_morphology)
`;
    navigator.clipboard.writeText(pyCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Module Identity & Operational Status */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 mt-1 shadow-inner">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Acoustic Shadow Analysis & 3D Profiler Module
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                  Node 7 Sub-Engine
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-950 text-purple-300 border border-purple-800/80">
                  Ray-Tracing & Morphology
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Reconstructs true 3D physical elevation from acoustic shadow length (<code className="text-cyan-300 font-mono">h = H·L / (R_g + L)</code>),
                analyzes cross-track backscatter extinction contrast (<code className="text-cyan-300 font-mono">ΔI ≥ 12 dB</code>), and classifies shadow morphology
                to eliminate 2D seabed ripples and flat rock false alarms.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowPythonDrawer(!showPythonDrawer)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              {showPythonDrawer ? 'Hide Python Edge Code' : 'View Python Engine'}
            </button>
            <button
              onClick={handleCopyPython}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Snippet Copied' : 'Copy Jetson Script'}
            </button>
          </div>
        </div>

        {/* Target Quick Switcher Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-mono uppercase text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            Inspect Target Shadow:
          </span>
          {targets.map((tgt) => {
            const isSel = tgt.id === activeTarget.id;
            const isHazard = tgt.status === 'CONFIRMED_HAZARD';
            return (
              <button
                key={tgt.id}
                onClick={() => handleSelectTarget(tgt)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  isSel
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400 shadow-sm font-bold'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isHazard ? 'bg-rose-400' : 'bg-slate-500'}`} />
                <span>{tgt.name.split('&')[0]}</span>
                <span className="text-[10px] opacity-75 font-normal">
                  L={tgt.shadowLengthL}m | h={tgt.calculatedHeight.toFixed(2)}m
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Standalone Python Edge Script Drawer (Expandable) */}
      {showPythonDrawer && (
        <div className="bg-slate-900 border border-purple-800/60 rounded-xl p-4 shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-mono font-bold text-slate-200">
                acoustic_shadow_analyzer.py • NVIDIA Jetson Edge Implementation
              </h3>
            </div>
            <span className="text-[11px] font-mono text-purple-300">
              58+ FPS Vectorized NumPy / GPU Ray Inversion
            </span>
          </div>
          <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800/80 leading-relaxed max-h-60 overflow-y-auto">
{`from acoustic_shadow_analyzer import AcousticShadowAnalyzer

# Instantiate Edge Shadow Engine with physical validation constraints
analyzer = AcousticShadowAnalyzer(
    min_shadow_length_m=${minShadowLen.toFixed(2)},
    min_contrast_db=${minContrastDb.toFixed(1)},
    min_height_m=${minHeight.toFixed(2)}
)

# Run evaluation for ${activeTarget.id}
report = analyzer.analyze_target_shadow(
    target_id="${activeTarget.id}",
    target_name="${activeTarget.name}",
    target_type="${activeTarget.type}",
    altitude_h=${altH.toFixed(1)},
    ground_range_rg=${groundRg.toFixed(1)},
    shadow_length_l=${shadowL.toFixed(1)},
    measured_contrast_db=${summary.extinctionContrastDb.toFixed(1)}
)

# Outputs:
# Decision: \${report.status} (Gate Passed: \${report.shadow_gate_passed})
# Calculated 3D Height: \${report.calculated_height_m}m ± \${report.height_uncertainty_m}m
# Extinction Contrast: \${report.extinction_contrast_db} dB
# Grazing Angle: \${report.grazing_angle_deg}° | Morphology: \${report.shadow_morphology}`}
          </pre>
        </div>
      )}

      {/* Main Analysis Grid: Section 1 & Section 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Ray-Casting Visualizer & Cross-Track Intensity Profile */}
        <div className="lg:col-span-8 space-y-6">
          {/* Component 1: Acoustic Ray-Casting Elevation Geometry (SVG) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  1. Acoustic Ray-Casting & Similar Triangles Geometry
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 font-semibold">
                  θ_g = {summary.grazingAngleDeg}° Grazing Angle
                </span>
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  R_s = {summary.slantRangeRs}m Slant Range
                </span>
              </div>
            </div>

            {/* Interactive SVG Diagram */}
            <div className="relative bg-slate-950/80 rounded-lg border border-slate-800 p-2 overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto select-none">
                <defs>
                  {/* Acoustic Wave Beam Gradient */}
                  <linearGradient id="beamGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                  </linearGradient>

                  {/* Shadow Zone Gradient */}
                  <linearGradient id="shadowZoneGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.95" />
                    <stop offset="80%" stopColor="#1e293b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#334155" stopOpacity="0.4" />
                  </linearGradient>

                  {/* Highlight Glow Filter */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Grid guidelines */}
                <line x1={margin.left} y1={seabedY} x2={svgWidth - margin.right} y2={seabedY} stroke="#334155" strokeWidth="2" />
                <line x1={margin.left} y1={txY} x2={svgWidth - margin.right} y2={txY} stroke="#1e293b" strokeDasharray="4,4" strokeWidth="1" />

                {/* Seabed substrate hatching */}
                <rect x={margin.left} y={seabedY} width={plotW} height={svgHeight - seabedY} fill="#0b1120" />
                <text x={margin.left + 8} y={seabedY + 16} fill="#64748b" fontSize="10" fontFamily="monospace">
                  Seafloor Bedrock / Sediment (Datum Y=0)
                </text>

                {/* Acoustic Main Beam Projection to Seabed */}
                <polygon
                  points={`${txX},${txY} ${targetX},${seabedY} ${targetX + 6},${targetApexY} ${margin.left + 20},${seabedY}`}
                  fill="url(#beamGradient)"
                />

                {/* Specular Highlight on Facing Edge */}
                <line
                  x1={targetX}
                  y1={seabedY}
                  x2={targetX}
                  y2={targetApexY}
                  stroke="#fbbf24"
                  strokeWidth="5"
                  filter="url(#glow)"
                />
                <circle cx={targetX} cy={targetApexY} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />

                {/* Direct Grazing Ray (Tangent touching apex to shadow tip) */}
                <line
                  x1={txX}
                  y1={txY}
                  x2={shadowEndX}
                  y2={seabedY}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="5,3"
                />

                {/* Acoustic Shadow Zone (Occluded Triangle) */}
                {shadowL > 0.05 && (
                  <polygon
                    points={`${targetX},${seabedY} ${targetX},${targetApexY} ${shadowEndX},${seabedY}`}
                    fill="url(#shadowZoneGrad)"
                    stroke="#0284c7"
                    strokeWidth="1.5"
                  />
                )}

                {/* Transducer / AUV Icon & Altitude Dimension */}
                <circle cx={txX} cy={txY} r="7" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                <text x={txX + 12} y={txY + 4} fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  AUV Sonar Transducer (H = {altH.toFixed(1)}m)
                </text>

                {/* Vertical Altitude H Dimension Line */}
                <line x1={txX - 16} y1={txY} x2={txX - 16} y2={seabedY} stroke="#0284c7" strokeWidth="1.5" />
                <line x1={txX - 22} y1={txY} x2={txX - 10} y2={txY} stroke="#0284c7" strokeWidth="1.5" />
                <line x1={txX - 22} y1={seabedY} x2={txX - 10} y2={seabedY} stroke="#0284c7" strokeWidth="1.5" />
                <text x={txX - 52} y={(txY + seabedY) / 2 + 4} fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  H={altH.toFixed(1)}m
                </text>

                {/* Ground Range Rg Dimension Line */}
                <line x1={txX} y1={seabedY + 24} x2={targetX} y2={seabedY + 24} stroke="#94a3b8" strokeWidth="1.5" />
                <line x1={txX} y1={seabedY + 18} x2={txX} y2={seabedY + 30} stroke="#94a3b8" strokeWidth="1.5" />
                <line x1={targetX} y1={seabedY + 18} x2={targetX} y2={seabedY + 30} stroke="#94a3b8" strokeWidth="1.5" />
                <text x={(txX + targetX) / 2 - 28} y={seabedY + 38} fill="#cbd5e1" fontSize="11" fontFamily="monospace">
                  R_g = {groundRg.toFixed(1)}m
                </text>

                {/* Shadow Length L Dimension Line */}
                {shadowL > 0.05 && (
                  <>
                    <line x1={targetX} y1={seabedY - 14} x2={shadowEndX} y2={seabedY - 14} stroke="#06b6d4" strokeWidth="2" />
                    <line x1={targetX} y1={seabedY - 20} x2={targetX} y2={seabedY - 8} stroke="#06b6d4" strokeWidth="2" />
                    <line x1={shadowEndX} y1={seabedY - 20} x2={shadowEndX} y2={seabedY - 8} stroke="#06b6d4" strokeWidth="2" />
                    <text x={(targetX + shadowEndX) / 2 - 24} y={seabedY - 22} fill="#06b6d4" fontSize="11" fontFamily="monospace" fontWeight="bold">
                      L_shadow = {shadowL.toFixed(2)}m
                    </text>
                  </>
                )}

                {/* Target Height h Callout */}
                <text x={targetX + 8} y={targetApexY - 8} fill="#f59e0b" fontSize="12" fontWeight="bold" fontFamily="monospace">
                  h = {summary.calculatedHeightM.toFixed(2)}m (±{summary.heightUncertaintyM}m)
                </text>

                {/* Mathematical Formula Card inside SVG */}
                <g transform="translate(420, 25)">
                  <rect x="0" y="0" width="265" height="68" rx="6" fill="#0f172a" fillOpacity="0.9" stroke="#334155" strokeWidth="1" />
                  <text x="12" y="18" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    SIMILAR TRIANGLES RECONSTRUCTION:
                  </text>
                  <text x="12" y="36" fill="#f1f5f9" fontSize="12" fontFamily="monospace" fontWeight="bold">
                    h = (H · L) / (R_g + L)
                  </text>
                  <text x="12" y="54" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    h = ({altH.toFixed(1)} · {shadowL.toFixed(1)}) / ({(groundRg + shadowL).toFixed(1)}) = <tspan fill="#34d399" fontWeight="bold">{summary.calculatedHeightM.toFixed(2)}m</tspan>
                  </text>
                </g>
              </svg>
            </div>

            {/* Quick parameter summary pills */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">RECONSTRUCTED 3D HEIGHT</span>
                <span className={`text-sm font-bold ${isHeightPass ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {summary.calculatedHeightM.toFixed(2)} m
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">SHADOW LENGTH (L)</span>
                <span className={`text-sm font-bold ${isShadowLengthPass ? 'text-cyan-400' : 'text-slate-400'}`}>
                  {summary.shadowLengthM.toFixed(2)} m
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">EXTINCTION CONTRAST</span>
                <span className={`text-sm font-bold ${isContrastPass ? 'text-purple-400' : 'text-amber-400'}`}>
                  {summary.extinctionContrastDb.toFixed(1)} dB
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">SHADOW MORPHOLOGY</span>
                <span className="text-sm font-bold text-white uppercase">
                  {summary.shadowMorphology.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Component 2: Cross-Track Intensity Profile (A-Scan Transect Chart) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-white text-sm">
                  2. Cross-Track Acoustic Backscatter Profile I(R) [A-Scan Transect]
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-amber-400 font-semibold">Peak: {summary.highlightPeakDb} dB</span>
                <span className="text-slate-500">|</span>
                <span className="text-cyan-400 font-semibold">Trough: {summary.shadowFloorDb} dB</span>
                <span className="text-slate-500">|</span>
                <span className="text-emerald-400 font-bold">ΔI = {summary.extinctionContrastDb} dB</span>
              </div>
            </div>

            {/* Interactive Profile Chart (SVG) */}
            <div className="relative bg-slate-950/90 rounded-lg border border-slate-800 p-2 overflow-hidden">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto select-none"
                onMouseLeave={() => setHoveredProfilePoint(null)}
              >
                {/* Horizontal dB grid lines */}
                {[-40, -30, -20, -10, 0].map((db) => {
                  const y = getChartY(db);
                  return (
                    <g key={db}>
                      <line x1={chartMargin.left} y1={y} x2={chartWidth - chartMargin.right} y2={y} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="1" />
                      <text x={chartMargin.left - 8} y={y + 3} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                        {db} dB
                      </text>
                    </g>
                  );
                })}

                {/* Vertical Range Grid Lines */}
                {[minRange, minRange + rangeSpan * 0.25, minRange + rangeSpan * 0.5, minRange + rangeSpan * 0.75, maxRange].map((r) => {
                  const x = getChartX(r);
                  return (
                    <g key={r}>
                      <line x1={x} y1={chartMargin.top} x2={x} y2={chartHeight - chartMargin.bottom} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="1" />
                      <text x={x} y={chartHeight - chartMargin.bottom + 16} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
                        {r.toFixed(1)}m
                      </text>
                    </g>
                  );
                })}

                {/* Ambient Seabed Baseline */}
                <line
                  x1={chartMargin.left}
                  y1={getChartY(summary.ambientSeabedDb)}
                  x2={chartWidth - chartMargin.right}
                  y2={getChartY(summary.ambientSeabedDb)}
                  stroke="#475569"
                  strokeWidth="1"
                  strokeDasharray="4,2"
                />
                <text x={chartWidth - chartMargin.right - 4} y={getChartY(summary.ambientSeabedDb) - 5} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
                  Ambient Seabed Baseline ({summary.ambientSeabedDb} dB)
                </text>

                {/* Area fill for Acoustic Shadow Void */}
                {shadowFillD && (
                  <path d={shadowFillD} fill="#0284c7" fillOpacity="0.18" />
                )}

                {/* Main Backscatter Intensity Curve */}
                <path d={profilePathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

                {/* Specular Highlight Peak Marker */}
                {shadowL > 0.05 && (
                  <g>
                    <circle cx={getChartX(groundRg + 0.6)} cy={getChartY(summary.highlightPeakDb)} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={getChartX(groundRg + 0.6)} y={getChartY(summary.highlightPeakDb) - 8} fill="#fbbf24" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      Specular Peak ({summary.highlightPeakDb} dB)
                    </text>
                  </g>
                )}

                {/* Shadow Extinction Trough Marker */}
                {shadowL > 0.05 && (
                  <g>
                    <circle cx={getChartX(groundRg + 1.2 + shadowL * 0.5)} cy={getChartY(summary.shadowFloorDb)} r="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x={getChartX(groundRg + 1.2 + shadowL * 0.5)} y={getChartY(summary.shadowFloorDb) + 16} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      Shadow Void ({summary.shadowFloorDb} dB)
                    </text>
                  </g>
                )}

                {/* Interactive Points Hover Detection */}
                {points.map((pt, idx) => {
                  const x = getChartX(pt.rangeMeters);
                  const y = getChartY(pt.intensityDb);
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="7"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredProfilePoint(pt)}
                    />
                  );
                })}

                {/* Tooltip on Hover */}
                {hoveredProfilePoint && (
                  <g>
                    <line
                      x1={getChartX(hoveredProfilePoint.rangeMeters)}
                      y1={chartMargin.top}
                      x2={getChartX(hoveredProfilePoint.rangeMeters)}
                      y2={chartHeight - chartMargin.bottom}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                    />
                    <circle
                      cx={getChartX(hoveredProfilePoint.rangeMeters)}
                      cy={getChartY(hoveredProfilePoint.intensityDb)}
                      r="5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>
            </div>

            {/* Hover Tooltip Information Banner */}
            <div className="mt-2 text-xs font-mono p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-slate-300">
              {hoveredProfilePoint ? (
                <>
                  <span className="text-amber-400 font-bold">
                    R = {hoveredProfilePoint.rangeMeters.toFixed(2)}m • {hoveredProfilePoint.intensityDb.toFixed(1)} dB
                  </span>
                  <span className="text-slate-400">
                    Zone: <strong className="text-cyan-300 uppercase">{hoveredProfilePoint.region.replace('_', ' ')}</strong> ({hoveredProfilePoint.description})
                  </span>
                </>
              ) : (
                <span className="text-slate-500">
                  Hover anywhere along the cross-track transect curve to inspect point-by-point backscatter decibels and acoustic zone.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Aperture Inspector, Morphology & Live Tuning */}
        <div className="lg:col-span-4 space-y-6">
          {/* Component 3: 2D Synthetic Aperture & Edge Gradient Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">3. Sonar Aperture & Mask</h3>
              </div>
              <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[10px] font-mono">
                <button
                  onClick={() => setActiveApertureTab('raw')}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    activeApertureTab === 'raw' ? 'bg-cyan-900 text-cyan-200 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sonar
                </button>
                <button
                  onClick={() => setActiveApertureTab('mask')}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    activeApertureTab === 'mask' ? 'bg-cyan-900 text-cyan-200 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mask
                </button>
                <button
                  onClick={() => setActiveApertureTab('gradient')}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    activeApertureTab === 'gradient' ? 'bg-cyan-900 text-cyan-200 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  EEB Edge
                </button>
              </div>
            </div>

            {/* Aperture Preview Canvas / Box */}
            <div className="relative aspect-video w-full rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden p-3">
              {activeApertureTab === 'raw' && (
                <div className="w-full h-full relative rounded border border-amber-900/40 bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 flex items-center justify-center">
                  {/* Highlight box */}
                  <div className="absolute left-[20%] w-[25%] h-[60%] border-2 border-amber-400 bg-amber-400/20 rounded-sm flex items-center justify-center">
                    <span className="text-[9px] font-mono font-bold text-amber-300">Highlight Echo</span>
                  </div>
                  {/* Shadow box */}
                  {shadowL > 0.05 ? (
                    <div className="absolute left-[45%] w-[45%] h-[60%] border-2 border-cyan-400 bg-cyan-950/80 rounded-sm flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-cyan-300">Shadow Occlusion</span>
                    </div>
                  ) : (
                    <div className="absolute left-[50%] text-[11px] font-mono text-slate-500">
                      Zero Trailing Shadow
                    </div>
                  )}
                </div>
              )}

              {activeApertureTab === 'mask' && (
                <div className="w-full h-full relative rounded border border-cyan-900/40 bg-black flex items-center justify-center">
                  {shadowL > 0.05 ? (
                    <div className="w-[60%] h-[60%] bg-cyan-400 rounded-sm shadow-[0_0_15px_rgba(6,182,212,0.6)] flex items-center justify-center text-slate-950 font-bold text-xs font-mono">
                      BINARY SHADOW MASK (1.0)
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-slate-600">ZERO MASK EXTRACTED</span>
                  )}
                </div>
              )}

              {activeApertureTab === 'gradient' && (
                <div className="w-full h-full relative rounded border border-purple-900/40 bg-slate-950 flex items-center justify-center">
                  {shadowL > 0.05 ? (
                    <div className="w-[65%] h-[65%] border-2 border-dashed border-purple-400 rounded-sm flex items-center justify-center text-purple-300 font-mono text-xs">
                      EEB Sobel Gradient: G = {summary.edgeGradientScore}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-slate-600">Flat Texture (G = 0.12)</span>
                  )}
                </div>
              )}
            </div>

            {/* Morphological Attribute Breakdown */}
            <div className="mt-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Shadow Aspect Ratio (L/W):</span>
                <span className="text-slate-200 font-bold">
                  {(shadowL / Math.max(0.5, activeTarget.objectWidth)).toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Penumbra Width (ΔRp):</span>
                <span className="text-cyan-400 font-bold">{summary.penumbraWidthM} m</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Edge Gradient (G_EEB):</span>
                <span className="text-purple-400 font-bold">{summary.edgeGradientScore} / 1.0</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Occlusion Area:</span>
                <span className="text-emerald-400 font-bold">
                  {(shadowL * activeTarget.objectWidth).toFixed(1)} m²
                </span>
              </div>
            </div>
          </div>

          {/* Component 4: Real-Time Parameter Tuning & Calibration */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm">4. Shadow Calibration Lab</h3>
              </div>
              <button
                onClick={() => {
                  setAltH(telemetry.auvAltitudeH);
                  setGroundRg(activeTarget.groundRangeRg);
                  setShadowL(activeTarget.shadowLengthL);
                  setMinContrastDb(12.0);
                  setMinShadowLen(0.50);
                  setMinHeight(0.20);
                }}
                className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* Slider 1: Transducer Altitude H */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Sensor Altitude (H):</span>
                <span className="text-cyan-400 font-bold">{altH.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="25.0"
                step="0.5"
                value={altH}
                onChange={(e) => setAltH(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 2: Ground Range Rg */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Ground Range (R_g):</span>
                <span className="text-cyan-400 font-bold">{groundRg.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="5.0"
                max="45.0"
                step="0.5"
                value={groundRg}
                onChange={(e) => setGroundRg(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 3: Shadow Length L */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Shadow Length (L):</span>
                <span className="text-cyan-400 font-bold">{shadowL.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="12.0"
                step="0.1"
                value={shadowL}
                onChange={(e) => setShadowL(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 4: Min Extinction Contrast Threshold */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Min Contrast Threshold:</span>
                <span className="text-purple-400 font-bold">{minContrastDb.toFixed(1)} dB</span>
              </div>
              <input
                type="range"
                min="6.0"
                max="25.0"
                step="0.5"
                value={minContrastDb}
                onChange={(e) => setMinContrastDb(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>

            {/* Slider 5: Min Height Threshold */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Min 3D Height Threshold (h_min):</span>
                <span className="text-emerald-400 font-bold">{minHeight.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={minHeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setMinHeight(val);
                  setPreprocessingParams((prev) => ({ ...prev, minHeightThreshold: val }));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            {/* Final Live Gate Decision Card */}
            <div className={`p-3 rounded-lg border text-xs font-mono leading-relaxed ${
              isGateConfirmed
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {isGateConfirmed ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>
                  {isGateConfirmed ? 'CONFIRMED 3D MARINE HAZARD' : 'REJECTED: NATURAL SEABED / FLAT BEDFORM'}
                </span>
              </div>
              <p className="text-[11px] opacity-90">{summary.shadowDiagnostic}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Component 5: Multi-Target Comparative Acoustic Shadow Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                5. Multi-Target Acoustic Shadow Comparative Matrix
              </h3>
              <p className="text-xs text-slate-400">
                Live verification across all active mission anomalies. True man-made hazards feature clear trailing acoustic shadows with &gt;12 dB extinction.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
            {targets.filter((t) => t.status === 'CONFIRMED_HAZARD').length} Confirmed / {targets.length} Total Targets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                <th className="py-2.5 px-3">Target & ID</th>
                <th className="py-2.5 px-3">Ground Range</th>
                <th className="py-2.5 px-3">Shadow Length</th>
                <th className="py-2.5 px-3">3D Height (h)</th>
                <th className="py-2.5 px-3">Extinction (ΔI)</th>
                <th className="py-2.5 px-3">Grazing Angle</th>
                <th className="py-2.5 px-3">Morphology</th>
                <th className="py-2.5 px-3 text-right">Acoustic Gate Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {targets.map((tgt) => {
                const isSelected = tgt.id === activeTarget.id;
                const isHazard = tgt.status === 'CONFIRMED_HAZARD';
                const contrast = tgt.shadowContrastDb ?? (tgt.shadowLengthL > 0.5 ? 21.0 : 4.0);
                const morph = tgt.shadowMorphology ?? (tgt.shadowLengthL > 0.5 ? 'draped_mesh' : 'diffuse_bedform');
                const grazing = tgt.grazingAngleDeg ?? Number(((Math.atan2(telemetry.auvAltitudeH, tgt.groundRangeRg) * 180) / Math.PI).toFixed(1));

                return (
                  <tr
                    key={tgt.id}
                    onClick={() => handleSelectTarget(tgt)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/50 hover:bg-cyan-950/70 text-cyan-100 font-semibold'
                        : 'hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{tgt.name}</div>
                      <div className="text-[10px] text-slate-500">{tgt.id} • {tgt.type}</div>
                    </td>
                    <td className="py-2.5 px-3">{tgt.groundRangeRg.toFixed(1)} m</td>
                    <td className="py-2.5 px-3">
                      <span className={tgt.shadowLengthL > 0.5 ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                        {tgt.shadowLengthL.toFixed(2)} m
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {tgt.calculatedHeight.toFixed(2)} m
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={contrast >= 12.0 ? 'text-purple-400 font-bold' : 'text-amber-400'}>
                        {contrast.toFixed(1)} dB
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{grazing}°</td>
                    <td className="py-2.5 px-3 uppercase text-[10px]">
                      {morph.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isHazard ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-700/80 text-rose-300 text-[11px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          CONFIRMED HAZARD
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 text-[11px]">
                          <XCircle className="w-3 h-3 text-slate-500" />
                          REJECTED FLAT
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
