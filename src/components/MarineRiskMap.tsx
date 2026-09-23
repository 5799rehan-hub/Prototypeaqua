import React, { useState } from 'react';
import { 
  Compass, 
  MapPin, 
  Navigation, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ship
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

interface MarineRiskMapProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
}

export const MarineRiskMap: React.FC<MarineRiskMapProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
}) => {
  const [showSwathCorridor, setShowSwathCorridor] = useState<boolean>(true);
  const [showRejectedFeatures, setShowRejectedFeatures] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Map coordinates bounding box around Gulf of Mannar survey zone
  // Base origin: Lat 9.1840 N, Lon 79.1240 E
  const ORIGIN_LAT = 9.1840;
  const ORIGIN_LON = 79.1240;
  const LAT_SPAN = 0.0035;
  const LON_SPAN = 0.0045;

  const MAP_WIDTH = 760;
  const MAP_HEIGHT = 440;

  // Convert GPS (lat, lon) to Canvas X, Y
  const gpsToMap = (lat: number, lon: number) => {
    const xNorm = (lon - (ORIGIN_LON - LON_SPAN / 2)) / LON_SPAN;
    const yNorm = 1.0 - (lat - (ORIGIN_LAT - LAT_SPAN / 2)) / LAT_SPAN; // Inverted Y for latitude
    return {
      x: Math.max(30, Math.min(MAP_WIDTH - 30, xNorm * MAP_WIDTH)),
      y: Math.max(30, Math.min(MAP_HEIGHT - 30, yNorm * MAP_HEIGHT)),
    };
  };

  // AUV Survey trajectory waypoints
  const auvTrackPoints = [
    { lat: 9.1852, lon: 79.1225 },
    { lat: 9.1845, lon: 79.1235 },
    { lat: 9.1840, lon: 79.1245 },
    { lat: 9.1832, lon: 79.1255 },
    { lat: 9.1825, lon: 79.1268 },
  ];

  const auvCurrentGps = { lat: 9.1832, lon: 79.1255 };
  const auvMapPos = gpsToMap(auvCurrentGps.lat, auvCurrentGps.lon);

  return (
    <div id="marine-risk-map-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              FLOWCHART NODES 8 & 9
            </span>
            <span className="text-xs font-mono text-slate-400">
              Geo-Tagging & Tactical Marine Risk Map
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            Real-Time Seabed Hazard & Debris Navigation Overlay
          </h2>
        </div>

        {/* Map Display Filter Toggles */}
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showSwathCorridor}
              onChange={(e) => setShowSwathCorridor(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 cursor-pointer"
            />
            Swath Coverage ({telemetry.maxSlantRange * 2}m Corridor)
          </label>

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showRejectedFeatures}
              onChange={(e) => setShowRejectedFeatures(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-slate-500 cursor-pointer"
            />
            Show Rejected Flat Bedforms
          </label>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="relative bg-[#020b17] rounded-xl border border-slate-800 overflow-hidden shadow-inner flex justify-center">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="w-full max-w-[760px] h-auto select-none"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="bathymetricGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(30, 58, 138, 0.25)" strokeWidth="1" />
            </pattern>

            {/* Swath Corridor Hatch */}
            <pattern id="swathCorridor" width="12" height="12" patternTransform="rotate(35 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="12" stroke="#0284c7" strokeWidth="1.5" strokeOpacity="0.2" />
            </pattern>
          </defs>

          {/* Ocean Nautical Chart Base */}
          <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="#030c1b" />
          <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#bathymetricGrid)" />

          {/* Depth Contours (Simulated Bathymetry) */}
          <path
            d="M 0 120 Q 200 160 400 140 T 760 170"
            fill="none"
            stroke="rgba(56, 189, 248, 0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="30" y="115" fill="rgba(56, 189, 248, 0.3)" fontSize="10" fontFamily="monospace">
            -32.0m ISOBATH
          </text>

          <path
            d="M 0 240 Q 250 290 500 260 T 760 300"
            fill="none"
            stroke="rgba(56, 189, 248, 0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="30" y="235" fill="rgba(56, 189, 248, 0.3)" fontSize="10" fontFamily="monospace">
            -35.0m ISOBATH
          </text>

          {/* Swath Corridor (Surveyed Acoustic Footprint) */}
          {showSwathCorridor && (
            <polygon
              points="100,50 680,390 620,430 40,90"
              fill="url(#swathCorridor)"
              stroke="rgba(14, 165, 233, 0.3)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )}

          {/* AUV Navigation Track Line */}
          <polyline
            points={auvTrackPoints.map((p) => {
              const pos = gpsToMap(p.lat, p.lon);
              return `${pos.x},${pos.y}`;
            }).join(' ')}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeDasharray="6 3"
          />

          {/* Waypoint dots */}
          {auvTrackPoints.map((p, idx) => {
            const pos = gpsToMap(p.lat, p.lon);
            return (
              <circle key={idx} cx={pos.x} cy={pos.y} r="3" fill="#0891b2" />
            );
          })}

          {/* Current AUV Position Icon */}
          <g transform={`translate(${auvMapPos.x}, ${auvMapPos.y})`}>
            <circle cx="0" cy="0" r="14" fill="rgba(6, 182, 212, 0.2)" className="animate-ping" />
            <circle cx="0" cy="0" r="7" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
            {/* Heading vector */}
            <line x1="0" y1="0" x2="16" y2="12" stroke="#38bdf8" strokeWidth="2" />
            <text x="12" y="-10" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
              AUV (H={telemetry.auvAltitudeH}m)
            </text>
          </g>

          {/* Geotagged Hazard Markers */}
          {targets.map((tgt) => {
            if (tgt.status === 'REJECTED_FALSE_POSITIVE' && !showRejectedFeatures) {
              return null;
            }

            const pos = gpsToMap(tgt.latitude, tgt.longitude);
            const isConfirmed = tgt.status === 'CONFIRMED_HAZARD';
            const isSelected = selectedTarget?.id === tgt.id;

            return (
              <g
                key={tgt.id}
                onClick={() => onSelectTarget(tgt)}
                className="cursor-pointer"
                transform={`translate(${pos.x}, ${pos.y})`}
              >
                {/* Threat Zone Radius if confirmed */}
                {isConfirmed && (
                  <circle
                    cx="0"
                    cy="0"
                    r={isSelected ? 32 : 24}
                    fill="rgba(244, 63, 94, 0.18)"
                    stroke="rgba(244, 63, 94, 0.6)"
                    strokeWidth="1.5"
                    strokeDasharray={isSelected ? '2 2' : 'none'}
                  />
                )}

                {/* Pin marker */}
                <circle
                  cx="0"
                  cy="0"
                  r={isSelected ? 8 : 6}
                  fill={isConfirmed ? '#f43f5e' : '#64748b'}
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* Target Label */}
                <text
                  x="10"
                  y="4"
                  fill={isConfirmed ? '#fda4af' : '#94a3b8'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {tgt.id} [{isConfirmed ? `NET h=${tgt.calculatedHeight}m` : 'FLAT ROCK'}]
                </text>
              </g>
            );
          })}

          {/* Compass Rose in Corner */}
          <g transform="translate(710, 50)">
            <circle cx="0" cy="0" r="22" fill="rgba(15, 23, 42, 0.8)" stroke="#334155" />
            <polygon points="0,-18 4,-4 -4,-4" fill="#ef4444" />
            <polygon points="0,18 4,4 -4,4" fill="#94a3b8" />
            <text x="-4" y="-22" fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="bold">N</text>
          </g>

          {/* Scale Bar */}
          <g transform="translate(30, 410)">
            <rect x="0" y="0" width="80" height="4" fill="#ffffff" />
            <rect x="80" y="0" width="80" height="4" fill="#0284c7" />
            <text x="0" y="18" fill="#94a3b8" fontSize="10" fontFamily="monospace">0m</text>
            <text x="75" y="18" fill="#94a3b8" fontSize="10" fontFamily="monospace">25m</text>
            <text x="150" y="18" fill="#94a3b8" fontSize="10" fontFamily="monospace">50m</text>
          </g>
        </svg>

        {/* Selected Anomaly Card Floating Overlay */}
        {selectedTarget && (
          <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur border border-slate-700/80 p-3 rounded-lg shadow-xl max-w-xs text-xs font-mono text-slate-300">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="font-bold text-white flex items-center gap-1.5">
                {selectedTarget.status === 'CONFIRMED_HAZARD' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                )}
                {selectedTarget.id}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  selectedTarget.status === 'CONFIRMED_HAZARD'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {selectedTarget.status === 'CONFIRMED_HAZARD' ? 'HAZARD' : 'REJECTED'}
              </span>
            </div>

            <div className="mt-2 space-y-1 text-[11px]">
              <div><span className="text-slate-500">Name:</span> {selectedTarget.name}</div>
              <div>
                <span className="text-slate-500">GPS:</span> {selectedTarget.latitude.toFixed(6)}°N, {selectedTarget.longitude.toFixed(6)}°E
              </div>
              <div><span className="text-slate-500">Seabed Depth:</span> {selectedTarget.depthMeters} m</div>
              <div>
                <span className="text-slate-500">3D Height (h):</span>{' '}
                <span className="text-rose-400 font-bold">{selectedTarget.calculatedHeight.toFixed(2)} m</span>
              </div>
              <div><span className="text-slate-500">Shadow Length (L):</span> {selectedTarget.shadowLengthL.toFixed(1)} m</div>
              <div><span className="text-slate-500">AI Confidence:</span> {(selectedTarget.aiConfidence * 100).toFixed(1)}%</div>
              <div><span className="text-slate-500">Marine Threat:</span> {selectedTarget.fusedRiskScore}%</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
