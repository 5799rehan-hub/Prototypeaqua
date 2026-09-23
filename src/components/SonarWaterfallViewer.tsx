import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Eye, 
  Layers, 
  Sliders, 
  Crosshair, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Maximize2, 
  Play, 
  Pause, 
  SkipForward, 
  Radio, 
  Zap, 
  Sparkles, 
  ShieldCheck, 
  Activity, 
  Cpu,
  Camera,
  Download,
  FileJson,
  FileSpreadsheet,
  MapPin,
  Copy,
  Check
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry, PreprocessingParams, ViewFilterMode } from '../types/sonar';
import { processCanvasSonarFrame } from '../utils/sonarAcousticMath';

interface SonarWaterfallViewerProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
  preprocessingParams: PreprocessingParams;
  setPreprocessingParams: React.Dispatch<React.SetStateAction<PreprocessingParams>>;
  isLiveScanning?: boolean;
  setIsLiveScanning?: (scanning: boolean) => void;
  onExportReport?: (format: 'json' | 'csv') => void;
}

export const SonarWaterfallViewer: React.FC<SonarWaterfallViewerProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
  preprocessingParams,
  setPreprocessingParams,
  isLiveScanning: externalIsScanning,
  setIsLiveScanning: externalSetIsScanning,
  onExportReport,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live Scanning State
  const [internalIsScanning, setInternalIsScanning] = useState<boolean>(true);
  const isScanning = externalIsScanning !== undefined ? externalIsScanning : internalIsScanning;
  const setIsScanning = externalSetIsScanning || setInternalIsScanning;

  const [pingRateHz, setPingRateHz] = useState<number>(10);
  const [currentPingIndex, setCurrentPingIndex] = useState<number>(1420);
  const [filterMode, setFilterMode] = useState<ViewFilterMode>('ground_unwarped');
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [boxMode, setBoxMode] = useState<'fused' | 'split'>('fused');
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number; rangeRg: number; ping: number; lat: number; lon: number } | null>(null);
  const [activePipelinePhase, setActivePipelinePhase] = useState<'both' | 'stage1_only' | 'stage2_only'>('both');

  // Frame Capture State
  const [captureFlash, setCaptureFlash] = useState<boolean>(false);
  const [captureSuccessMsg, setCaptureSuccessMsg] = useState<string | null>(null);
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);

  // Offset used for continuous water downward scrolling
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 450;

  // Animation frame loop for continuous live sonar streaming
  useEffect(() => {
    if (!isScanning) return;

    const intervalMs = Math.round(1000 / pingRateHz);
    const interval = setInterval(() => {
      setScrollOffset((prev) => (prev + 2) % CANVAS_HEIGHT);
      setCurrentPingIndex((prev) => prev + 1);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isScanning, pingRateHz]);

  // Step 1 Ping manually
  const handleStepPing = () => {
    setScrollOffset((prev) => (prev + 4) % CANVAS_HEIGHT);
    setCurrentPingIndex((prev) => prev + 1);
  };

  // Draw simulated raw sonar waterfall on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Generate base raw side-scan swath
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = CANVAS_WIDTH;
    rawCanvas.height = CANVAS_HEIGHT;
    const rawCtx = rawCanvas.getContext('2d');
    if (!rawCtx) return;

    const midX = CANVAS_WIDTH / 2;
    const nadirWidth = Math.max(16, (telemetry.auvAltitudeH / telemetry.maxSlantRange) * (CANVAS_WIDTH / 2));

    // Base dark navy ocean
    rawCtx.fillStyle = '#060d17';
    rawCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw ambient seabed backscatter with radial transmission loss & scroll offset
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const distFromCenter = Math.abs(x - midX);

      // Center nadir zone (water column - dark acoustic silence before first seafloor echo)
      if (distFromCenter < nadirWidth * 0.45) {
        rawCtx.fillStyle = '#02060c';
        rawCtx.fillRect(x, 0, 1, CANVAS_HEIGHT);
        continue;
      }

      // Natural acoustic transmission loss decay
      const normRange = (distFromCenter - nadirWidth * 0.45) / (CANVAS_WIDTH / 2);
      const transmissionDecay = Math.max(0.12, Math.exp(-normRange * 1.8));

      // Seabed sediment lines & random speckle noise
      const brightness = Math.round(transmissionDecay * 110);
      rawCtx.fillStyle = `rgb(${brightness + 20}, ${brightness + 10}, ${Math.max(10, brightness - 10)})`;
      rawCtx.fillRect(x, 0, 1, CANVAS_HEIGHT);
    }

    // Add acoustic speckle grain (with scrolling variation)
    const imgData = rawCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 45;
      d[i] = Math.min(255, Math.max(0, d[i] + noise));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise * 0.8));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise * 0.4));
    }
    rawCtx.putImageData(imgData, 0, 0);

    // Draw targets on raw canvas (drifting along waterfall as AUV moves)
    targets.forEach((tgt) => {
      const dynamicY = (tgt.highlightBBox.y + scrollOffset) % CANVAS_HEIGHT;

      // 1. Specular acoustic highlight
      rawCtx.fillStyle = 'rgba(255, 235, 170, 0.95)';
      rawCtx.fillRect(
        tgt.highlightBBox.x,
        dynamicY,
        tgt.highlightBBox.width,
        tgt.highlightBBox.height
      );

      // 2. Trailing acoustic shadow (acoustic occlusion behind target)
      if (tgt.shadowBBox) {
        rawCtx.fillStyle = '#020509';
        rawCtx.fillRect(
          tgt.shadowBBox.x,
          dynamicY,
          tgt.shadowBBox.width,
          tgt.shadowBBox.height
        );
      }
    });

    // Process frame through the requested acoustic physics filter (Stage 1)
    const processedImageData = processCanvasSonarFrame(
      rawCtx,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      filterMode,
      preprocessingParams,
      telemetry.auvAltitudeH,
      telemetry.maxSlantRange
    );

    ctx.putImageData(processedImageData, 0, 0);

    // Nadir Center Track Line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Channel Labels
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.fillText('◄ PORT SWATH', 15, 20);
    ctx.fillText('STARBOARD SWATH ►', CANVAS_WIDTH - 130, 20);
    ctx.fillText(`NADIR (AUV TRACK H=${telemetry.auvAltitudeH.toFixed(1)}m)`, midX - 75, CANVAS_HEIGHT - 12);
  }, [filterMode, targets, telemetry, preprocessingParams, scrollOffset]);

  // Handle Canvas Mouse Move for Crosshairs
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    const midX = CANVAS_WIDTH / 2;
    const distPx = Math.abs(x - midX);
    const mPerPx = (telemetry.maxSlantRange * 2) / CANVAS_WIDTH;
    const rangeRg = distPx * mPerPx;
    const ping = currentPingIndex - Math.round((CANVAS_HEIGHT - y) / 2);

    // Dynamic Geolocation Calculation for hovered water pixel
    const baseLat = targets[0]?.latitude || 9.184215;
    const baseLon = targets[0]?.longitude || 79.124580;
    const alongMeters = (CANVAS_HEIGHT / 2 - y) * 0.12; // Along-track AUV heading
    const acrossMeters = (x - midX) * mPerPx; // Across-track port/starboard
    const lat = baseLat + (alongMeters / 111139);
    const lon = baseLon + (acrossMeters / (111139 * Math.cos((baseLat * Math.PI) / 180)));

    setMouseCoords({ x, y, rangeRg, ping, lat, lon });
  };

  const handleMouseLeave = () => {
    setMouseCoords(null);
  };

  // Capture Current Live Sonar Frame & Save as Image with Full Geo-Coordinates
  const handleCaptureFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger visual camera flash
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 350);

    // Create high-res composite offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT + 75; // Extra space for tactical water recon banner
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw live water acoustic canvas frame
    ctx.drawImage(canvas, 0, 0);

    // Overlay object detections with exact Latitude & Longitude stamps
    if (showOverlays) {
      targets.forEach((tgt) => {
        const dynamicY = (tgt.highlightBBox.y + scrollOffset) % CANVAS_HEIGHT;
        const isConfirmed = tgt.status === 'CONFIRMED_HAZARD';

        // Draw detection box
        ctx.strokeStyle = isConfirmed ? '#f43f5e' : '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(tgt.highlightBBox.x, dynamicY, tgt.highlightBBox.width, tgt.highlightBBox.height);

        // Shadow box if present
        if (tgt.shadowBBox) {
          ctx.strokeStyle = 'rgba(129, 140, 248, 0.85)';
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(tgt.shadowBBox.x, dynamicY, tgt.shadowBBox.width, tgt.highlightBBox.height);
          ctx.setLineDash([]);
        }

        // Draw classification header badge
        ctx.fillStyle = isConfirmed ? 'rgba(159, 18, 57, 0.95)' : 'rgba(30, 41, 59, 0.95)';
        ctx.fillRect(tgt.highlightBBox.x, dynamicY - 20, 180, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${tgt.name.slice(0, 18)} (h=${tgt.calculatedHeight.toFixed(2)}m)`, tgt.highlightBBox.x + 4, dynamicY - 7);

        // Draw Latitude and Longitude coordinate pill on captured image
        ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.fillRect(tgt.highlightBBox.x, dynamicY + tgt.highlightBBox.height + 2, 240, 16);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tgt.highlightBBox.x, dynamicY + tgt.highlightBBox.height + 2, 240, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`LAT: ${tgt.latitude.toFixed(6)}°N | LON: ${tgt.longitude.toFixed(6)}°E`, tgt.highlightBBox.x + 4, dynamicY + tgt.highlightBBox.height + 13);
      });
    }

    // Draw tactical telemetry & coordinates banner at bottom of image
    ctx.fillStyle = '#0b1329';
    ctx.fillRect(0, CANVAS_HEIGHT, offscreen.width, 75);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, CANVAS_HEIGHT, offscreen.width, 75);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('AQUAGHOST ACOUSTIC WATER RECON • LIVE FRAME CAPTURE', 16, CANVAS_HEIGHT + 22);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    const nowIso = new Date().toISOString();
    ctx.fillText(`MISSION: ${telemetry.missionId} | PING #${currentPingIndex} | ALT: ${telemetry.auvAltitudeH.toFixed(1)}m | SWATH: ${(telemetry.maxSlantRange * 2).toFixed(0)}m | ${nowIso}`, 16, CANVAS_HEIGHT + 40);

    const hazards = targets.filter(t => t.status === 'CONFIRMED_HAZARD');
    ctx.fillStyle = hazards.length > 0 ? '#fb7185' : '#34d399';
    ctx.fillText(`DETECTED HAZARDS: ${hazards.length} CONFIRMED GHOST NETS | ALL TARGETS GEO-TAGGED WITH LATITUDE & LONGITUDE`, 16, CANVAS_HEIGHT + 58);

    // Trigger instant browser download
    const dataUrl = offscreen.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `AQUAGHOST_Water_Ping${currentPingIndex}_${Date.now()}.png`;
    link.click();

    setCapturedCount(prev => prev + 1);
    setCaptureSuccessMsg(`Frame #${currentPingIndex} Captured & Saved (PNG with Lat/Lon Stamps)`);
    setTimeout(() => setCaptureSuccessMsg(null), 4000);
  };

  const handleCopyCoords = (lat: number, lon: number) => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  return (
    <div id="sonar-water-module" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3 font-mono">
      {/* Module Title & Pipeline Stage Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              SPACE 1: LIVE SONAR SCAN STREAM
            </span>
            <span className="text-xs font-mono text-slate-400">
              Continuous AUV Sonar Water Stream (58.4 FPS Native)
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-0.5">
            Real-Time Acoustic Physics Denoising & Object Detection Stream
          </h2>
        </div>

        {/* Live Controls: Play/Pause, Step Ping, Capture Frame, Download JSON/CSV */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="capture-live-frame-btn"
            onClick={handleCaptureFrame}
            title="Capture current live sonar frame with Latitude & Longitude overlay and save image"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/60 cursor-pointer active:scale-95"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Capture & Save Image</span>
            {capturedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px]">
                {capturedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
              isScanning
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
            }`}
          >
            {isScanning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isScanning ? 'Pause Live Stream' : 'Resume Live Scan'}
          </button>

          <button
            onClick={handleStepPing}
            disabled={isScanning}
            className={`px-2.5 py-1.5 rounded-lg text-xs border flex items-center gap-1 transition-colors cursor-pointer ${
              isScanning
                ? 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <SkipForward className="w-3.5 h-3.5 text-cyan-400" />
            Step 1 Ping
          </button>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-slate-400">Ping Rate:</span>
            <select
              value={pingRateHz}
              onChange={(e) => setPingRateHz(parseInt(e.target.value))}
              className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value="5">5 Hz (Slow Sweep)</option>
              <option value="10">10 Hz (Standard)</option>
              <option value="15">15 Hz (High Speed)</option>
              <option value="25">25 Hz (Max Burst)</option>
            </select>
          </div>

          {onExportReport && (
            <div className="flex items-center gap-1 pl-1">
              <button
                onClick={() => onExportReport('json')}
                title="Download current detection data in JSON format"
                className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <FileJson className="w-3 h-3" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => onExportReport('csv')}
                title="Download current detection data in CSV format"
                className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Capture Feedback Notification */}
      {captureSuccessMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{captureSuccessMsg}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-mono">Saved to Local Downloads</span>
        </div>
      )}

      {/* Sequential 2-Stage Indicator Bar (First Filter, Then Detect) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {/* Stage 1 Indicator */}
        <div className="p-2 rounded-lg bg-slate-950 border border-cyan-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <div>
              <span className="text-cyan-400 font-bold uppercase text-[11px]">1. FIRST: ACOUSTIC NOISE FILTERING</span>
              <div className="text-[10px] text-slate-400">TVG Spherical + Homomorphic Despeckle + Pythagorean Unwarp</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
            SNR +14dB
          </span>
        </div>

        {/* Stage 2 Indicator */}
        <div className="p-2 rounded-lg bg-slate-950 border border-purple-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <div>
              <span className="text-purple-400 font-bold uppercase text-[11px]">2. THEN: 3D PHYSICS AI DETECTION</span>
              <div className="text-[10px] text-slate-400">GhostNetV2 Heads + 3D Shadow Trigonometry (h) + Risk Gate</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
            Gate: h ≥ {preprocessingParams.minHeightThreshold.toFixed(2)}m
          </span>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setFilterMode('raw')}
            className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
              filterMode === 'raw' ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Raw Acoustic
          </button>
          <button
            onClick={() => setFilterMode('tvg')}
            className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
              filterMode === 'tvg' ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. TVG Equalized
          </button>
          <button
            onClick={() => setFilterMode('speckle_filtered')}
            className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
              filterMode === 'speckle_filtered' ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Log Despeckled
          </button>
          <button
            onClick={() => setFilterMode('ground_unwarped')}
            className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
              filterMode === 'ground_unwarped' ? 'bg-cyan-600 text-white font-bold shadow-sm shadow-cyan-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            4. Pythagorean Unwarped (Full Clean)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showOverlays}
              onChange={(e) => setShowOverlays(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            Show Bounding Boxes
          </label>

          {showOverlays && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-[10px] font-mono">
              <button
                onClick={() => setBoxMode('fused')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  boxMode === 'fused'
                    ? 'bg-purple-900/80 text-purple-200 font-bold border border-purple-500 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Multi-Scale Fused Box
              </button>
              <button
                onClick={() => setBoxMode('split')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  boxMode === 'split'
                    ? 'bg-cyan-900/80 text-cyan-200 font-bold border border-cyan-500 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Separate Heads (Echo/Shadow)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Waterfall Canvas Viewport */}
      <div 
        ref={containerRef}
        className="relative bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-inner flex justify-center items-center select-none"
      >
        <canvas
          id="sonar-waterfall-canvas"
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-auto max-h-[500px] object-contain cursor-crosshair block"
        />

        {/* Real-time Bounding Box Overlays (drifting with waterfall) */}
        {showOverlays && (
          <div className="absolute inset-0 pointer-events-none">
            {targets.map((tgt) => {
              const dynamicY = (tgt.highlightBBox.y + scrollOffset) % CANVAS_HEIGHT;
              const isConfirmed = tgt.status === 'CONFIRMED_HAZARD';
              const isSelected = selectedTarget?.id === tgt.id;
              const fusedScore = tgt.fusedConfidenceScore ?? Math.round(tgt.aiConfidence * 100);
              const sObj = tgt.objectDetectorScore ?? tgt.aiConfidence;
              const sShd = tgt.shadowAnalysisScore ?? (tgt.shadowLengthL > 0.5 ? 0.90 : 0.10);
              const sAnom = tgt.anomalyDetectorScore ?? (tgt.status === 'CONFIRMED_HAZARD' ? 0.90 : 0.15);

              // Multi-Scale Fused Boundary Box mode
              if (boxMode === 'fused') {
                const fBox = tgt.fusedBBox || {
                  x: tgt.shadowBBox && tgt.shadowLengthL > 0.1
                    ? Math.min(tgt.highlightBBox.x, tgt.shadowBBox.x)
                    : tgt.highlightBBox.x,
                  y: tgt.shadowBBox && tgt.shadowLengthL > 0.1
                    ? Math.min(tgt.highlightBBox.y, tgt.shadowBBox.y)
                    : tgt.highlightBBox.y,
                  width: tgt.shadowBBox && tgt.shadowLengthL > 0.1
                    ? Math.max(tgt.highlightBBox.x + tgt.highlightBBox.width, tgt.shadowBBox.x + tgt.shadowBBox.width) - Math.min(tgt.highlightBBox.x, tgt.shadowBBox.x)
                    : tgt.highlightBBox.width,
                  height: tgt.shadowBBox && tgt.shadowLengthL > 0.1
                    ? Math.max(tgt.highlightBBox.y + tgt.highlightBBox.height, tgt.shadowBBox.y + tgt.shadowBBox.height) - Math.min(tgt.highlightBBox.y, tgt.shadowBBox.y)
                    : tgt.highlightBBox.height,
                };

                const leftPct = (fBox.x / CANVAS_WIDTH) * 100;
                const topPct = (dynamicY / CANVAS_HEIGHT) * 100;
                const widthPct = (fBox.width / CANVAS_WIDTH) * 100;
                const heightPct = (fBox.height / CANVAS_HEIGHT) * 100;

                return (
                  <div
                    key={tgt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTarget(tgt);
                    }}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    className={`absolute pointer-events-auto cursor-pointer border-2 transition-all rounded-sm ${
                      isSelected
                        ? 'border-amber-300 ring-2 ring-amber-400/60 shadow-[0_0_18px_rgba(245,158,11,0.9)] z-20'
                        : isConfirmed
                        ? 'border-purple-400 bg-purple-950/15 hover:border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                        : 'border-slate-500/70 border-dashed bg-slate-900/20 hover:border-slate-400'
                    }`}
                  >
                    {/* Header: Fused Confidence Score & Status */}
                    <div
                      className={`absolute -top-7 left-0 px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap flex items-center gap-1.5 font-bold shadow-md ${
                        isConfirmed
                          ? 'bg-purple-950 text-purple-200 border border-purple-500'
                          : 'bg-slate-900 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isConfirmed ? (
                        <AlertTriangle className="w-3 h-3 text-purple-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-slate-400" />
                      )}
                      <span>FUSED CONFIDENCE: {fusedScore}%</span>
                      <span className="opacity-60">|</span>
                      <span className={isConfirmed ? 'text-amber-300' : 'text-slate-400'}>
                        {isConfirmed ? `HAZARD (h=${tgt.calculatedHeight.toFixed(2)}m)` : 'REJECTED (FLAT)'}
                      </span>
                    </div>

                    {/* Sub-header: Tri-Feature Breakdown preview */}
                    <div className="absolute -top-3.5 left-0 px-1 py-0.1 rounded text-[8px] font-mono whitespace-nowrap bg-slate-950/90 text-slate-300 border border-slate-800">
                      Obj: {(sObj * 100).toFixed(0)}% • Shd: {(sShd * 100).toFixed(0)}% • Anom: {(sAnom * 100).toFixed(0)}%
                    </div>

                    {/* Footer: Latitude & Longitude */}
                    <div className="absolute -bottom-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap flex items-center gap-1 font-bold bg-slate-950/95 text-cyan-300 border border-cyan-500/70 shadow-md">
                      <MapPin className="w-2.5 h-2.5 text-cyan-400" />
                      <span>LAT: {tgt.latitude.toFixed(6)}°N</span>
                      <span className="text-slate-500">|</span>
                      <span>LON: {tgt.longitude.toFixed(6)}°E</span>
                    </div>
                  </div>
                );
              }

              // Separate Heads mode (Echo Highlight + Shadow Box)
              const leftPct = (tgt.highlightBBox.x / CANVAS_WIDTH) * 100;
              const topPct = (dynamicY / CANVAS_HEIGHT) * 100;
              const widthPct = (tgt.highlightBBox.width / CANVAS_WIDTH) * 100;
              const heightPct = (tgt.highlightBBox.height / CANVAS_HEIGHT) * 100;

              return (
                <div key={tgt.id}>
                  {/* Highlight Box */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTarget(tgt);
                    }}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    className={`absolute pointer-events-auto cursor-pointer border-2 transition-all ${
                      isSelected
                        ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]'
                        : isConfirmed
                        ? 'border-cyan-400 hover:border-cyan-300'
                        : 'border-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {/* Header Label Pill */}
                    <div
                      className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap flex items-center gap-1 font-bold ${
                        isConfirmed
                          ? 'bg-rose-900/90 text-rose-200 border border-rose-600'
                          : 'bg-slate-800 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {isConfirmed ? (
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5 text-slate-400" />
                      )}
                      <span>h = {tgt.calculatedHeight.toFixed(2)}m</span>
                      <span className="opacity-70 font-normal">
                        ({isConfirmed ? 'HAZARD' : 'REJECTED'})
                      </span>
                    </div>

                    {/* Object Coordinates Badge: LATITUDE & LONGITUDE */}
                    <div className="absolute -bottom-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap flex items-center gap-1 font-bold bg-slate-950/95 text-cyan-300 border border-cyan-500/70 shadow-md">
                      <MapPin className="w-2.5 h-2.5 text-cyan-400" />
                      <span>LAT: {tgt.latitude.toFixed(6)}°N</span>
                      <span className="text-slate-500">|</span>
                      <span>LON: {tgt.longitude.toFixed(6)}°E</span>
                    </div>
                  </div>

                  {/* Shadow Box (trailing acoustic shadow) */}
                  {tgt.shadowBBox && (
                    <div
                      style={{
                        left: `${(tgt.shadowBBox.x / CANVAS_WIDTH) * 100}%`,
                        top: `${topPct}%`,
                        width: `${(tgt.shadowBBox.width / CANVAS_WIDTH) * 100}%`,
                        height: `${heightPct}%`,
                      }}
                      className="absolute border border-dashed border-indigo-400/80 bg-indigo-950/20 pointer-events-none"
                    >
                      <span className="absolute -bottom-4 left-0 text-[9px] font-mono text-indigo-300 bg-slate-900/80 px-1 rounded">
                        L_shd = {tgt.shadowLengthL.toFixed(1)}m
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Shutter Camera Flash Animation on Capture */}
        {captureFlash && (
          <div className="absolute inset-0 bg-white/80 pointer-events-none z-30 transition-all flex items-center justify-center">
            <div className="bg-slate-950 text-amber-300 border border-amber-400 px-4 py-2 rounded-xl font-mono text-sm font-bold flex items-center gap-2 shadow-2xl">
              <Camera className="w-5 h-5 animate-pulse" />
              <span>FRAME CAPTURED & SAVED (PNG WITH GEO-STAMPS)</span>
            </div>
          </div>
        )}

        {/* Dynamic Telemetry HUD Overlay */}
        <div className="absolute top-2 left-2 bg-slate-950/85 backdrop-blur border border-slate-800/80 px-2.5 py-1.5 rounded text-[11px] font-mono text-slate-300 flex items-center gap-3 pointer-events-none shadow-md">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-400">PING:</span>{' '}
            <span className="text-cyan-300 font-bold">#{currentPingIndex}</span>
          </div>
          <div>
            <span className="text-slate-400">ALTITUDE:</span>{' '}
            <span className="text-sky-300">{telemetry.auvAltitudeH.toFixed(1)}m</span>
          </div>
          <div>
            <span className="text-slate-400">SWATH:</span>{' '}
            <span className="text-amber-300">{(telemetry.maxSlantRange * 2).toFixed(0)}m</span>
          </div>
        </div>

        {/* Hover Crosshairs Readout with Dynamic Lat/Lon */}
        {mouseCoords && (
          <div className="absolute bottom-2 right-2 bg-slate-950/90 backdrop-blur border border-cyan-500/40 px-3 py-1.5 rounded text-[11px] font-mono text-cyan-300 flex items-center gap-2.5 pointer-events-none shadow-lg">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Rg: {mouseCoords.rangeRg.toFixed(1)}m</span>
            <span>Ping #{mouseCoords.ping}</span>
            <span className="text-amber-300 font-bold">LAT: {mouseCoords.lat.toFixed(6)}°N</span>
            <span className="text-amber-300 font-bold">LON: {mouseCoords.lon.toFixed(6)}°E</span>
          </div>
        )}
      </div>

      {/* Selected Target Geo-Coordinates & Physics Dossier */}
      {selectedTarget && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded border ${
              selectedTarget.status === 'CONFIRMED_HAZARD'
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-400'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{selectedTarget.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedTarget.status === 'CONFIRMED_HAZARD'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {selectedTarget.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-slate-300 text-xs font-mono">
                <span className="text-cyan-300 font-bold">
                  📍 LAT: {selectedTarget.latitude.toFixed(6)}°N
                </span>
                <span className="text-cyan-300 font-bold">
                  LON: {selectedTarget.longitude.toFixed(6)}°E
                </span>
                <span className="text-purple-300 font-bold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/80">
                  Fused Score: {selectedTarget.fusedConfidenceScore ?? Math.round(selectedTarget.aiConfidence * 100)}%
                </span>
                <span className="text-amber-400 font-bold">
                  3D Height: {selectedTarget.calculatedHeight.toFixed(2)}m
                </span>
                <span className="text-slate-400">
                  Depth: {selectedTarget.depthMeters.toFixed(1)}m
                </span>
                <span className="text-slate-400 text-[11px]">
                  [Echo: {((selectedTarget.objectDetectorScore ?? selectedTarget.aiConfidence) * 100).toFixed(0)}% | Shd: {((selectedTarget.shadowAnalysisScore ?? 0.85) * 100).toFixed(0)}% | Anom: {((selectedTarget.anomalyDetectorScore ?? 0.85) * 100).toFixed(0)}%]
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyCoords(selectedTarget.latitude, selectedTarget.longitude)}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedCoords ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCoords ? 'Copied Coordinates' : 'Copy Lat/Lon'}</span>
            </button>

            {onExportReport && (
              <>
                <button
                  onClick={() => onExportReport('json')}
                  title="Download all targets with Lat/Lon in JSON format"
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-amber-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                <button
                  onClick={() => onExportReport('csv')}
                  title="Download all targets with Lat/Lon in CSV format"
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer Info & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800/80 text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 inline-block border border-rose-400"></span>
            Confirmed Hazard (h ≥ {preprocessingParams.minHeightThreshold.toFixed(2)}m)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block border border-slate-400"></span>
            Physics Rejected Flat Rock
          </span>
        </div>

        <div className="text-slate-400 font-mono text-[11px]">
          Physics Elevation Formula: <span className="text-cyan-400 font-bold">h = (H · L_shd) / (R_g + L_shd)</span>
        </div>
      </div>
    </div>
  );
};
