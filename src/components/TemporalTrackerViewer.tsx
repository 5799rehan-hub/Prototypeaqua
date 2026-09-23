import React, { useState, useEffect } from 'react';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  Activity, 
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Target,
  Sparkles,
  Compass
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

interface TemporalTrackerViewerProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
}

export const TemporalTrackerViewer: React.FC<TemporalTrackerViewerProps> = ({
  telemetry,
  targets,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simulatedPing, setSimulatedPing] = useState<number>(1144);
  const [minStreak, setMinStreak] = useState<number>(3);
  const [maxDriftM, setMaxDriftM] = useState<number>(0.40);
  const [activeTrackFilter, setActiveTrackFilter] = useState<'all' | 'persistent' | 'transient'>('all');

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimulatedPing((prev) => (prev >= 1148 ? 1140 : prev + 1));
    }, 1400);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Sequential acoustic ping tracking history audit
  const pingHistory = [
    {
      ping: 1140,
      timestamp: '10:14:02.10',
      trackId: 'TRK-0001',
      targetName: 'Ghost Net Mesh',
      hitStreak: 10,
      spatialDrift: 0.11,
      isPersistent: true,
      note: 'Acoustic highlight return locked at Rg = 18.5m; shadow boundary sharp.',
    },
    {
      ping: 1141,
      timestamp: '10:14:02.85',
      trackId: 'TRK-0001',
      targetName: 'Ghost Net Mesh',
      hitStreak: 11,
      spatialDrift: 0.12,
      isPersistent: true,
      note: 'Cross-ping correlation IoU = 0.91; spatial displacement Delta_d = 0.04m.',
    },
    {
      ping: 1142,
      timestamp: '10:14:03.60',
      trackId: 'TRK-0006',
      targetName: 'Fish School Spike',
      hitStreak: 1,
      spatialDrift: 2.85,
      isPersistent: false,
      note: 'Transient biological clutter detected in water column. Single ping hit.',
    },
    {
      ping: 1143,
      timestamp: '10:14:04.35',
      trackId: 'TRK-0001',
      targetName: 'Ghost Net Mesh',
      hitStreak: 12,
      spatialDrift: 0.13,
      isPersistent: true,
      note: 'Peak acoustic backscatter return; shadow length L = 6.8m confirmed.',
    },
    {
      ping: 1144,
      timestamp: '10:14:05.10',
      trackId: 'TRK-0006',
      targetName: 'Fish School Spike',
      hitStreak: 1,
      spatialDrift: 3.42,
      isPersistent: false,
      note: 'Missed ping on N+1 (streak 0). Dropped by Temporal Check as transient noise.',
    },
    {
      ping: 1145,
      timestamp: '10:14:05.85',
      trackId: 'TRK-0001',
      targetName: 'Ghost Net Mesh',
      hitStreak: 13,
      spatialDrift: 0.12,
      isPersistent: true,
      note: 'Predictable grazing shadow contraction observed as AUV advances.',
    },
    {
      ping: 1146,
      timestamp: '10:14:06.60',
      trackId: 'TRK-0003',
      targetName: 'Derelict Trap',
      hitStreak: 8,
      spatialDrift: 0.16,
      isPersistent: true,
      note: 'Secondary hazard locked; consistent shadow relief of 3.4m across 8 pings.',
    },
    {
      ping: 1147,
      timestamp: '10:14:07.35',
      trackId: 'TRK-0001',
      targetName: 'Ghost Net Mesh',
      hitStreak: 14,
      spatialDrift: 0.12,
      isPersistent: true,
      note: 'RepDNet & Temporal Check cross-verified: Persistent hazardous obstacle.',
    },
  ];

  const filteredHistory = pingHistory.filter((item) => {
    if (activeTrackFilter === 'persistent' && !item.isPersistent) return false;
    if (activeTrackFilter === 'transient' && item.isPersistent) return false;
    return true;
  });

  return (
    <div id="temporal-tracker-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              FLOWCHART NODE 6
            </span>
            <span className="text-xs font-mono text-slate-400">
              Multi-Ping Temporal Check & Seafloor Persistence Verification
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
            Temporal Ping Check & Transient Noise Elimination Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-3xl leading-relaxed">
            Side-scan sonar water columns are rife with transient artifacts (pelagic fish, bubble wakes, acoustic multipath).
            The <strong className="text-emerald-300">Temporal Check</strong> validates candidate hazards across consecutive pings.
            Genuine stationary obstacles persist over <span className="font-mono text-cyan-300">≥ {minStreak} consecutive pings</span> with spatial drift <span className="font-mono text-cyan-300">≤ {maxDriftM.toFixed(2)}m</span>.
          </p>
        </div>

        {/* Live Simulation Controls */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Current Ping: <strong className="text-cyan-400">#{simulatedPing}</strong></span>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 cursor-pointer"
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setSimulatedPing(1140)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 cursor-pointer"
            title="Reset ping sequence"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Temporal Check Parameters Slider Bar */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Min Ping Hit Streak Threshold (K_min):</span>
            </span>
            <span className="text-emerald-300 font-bold">{minStreak} Consecutive Pings</span>
          </div>
          <input
            type="range"
            min="2"
            max="6"
            step="1"
            value={minStreak}
            onChange={(e) => setMinStreak(parseInt(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
            <span>2 Pings (Aggressive)</span>
            <span>4 Pings (Standard)</span>
            <span>6 Pings (High Confidence)</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Max Seafloor Spatial Drift Tolerance (Δd_max):</span>
            </span>
            <span className="text-cyan-300 font-bold">{maxDriftM.toFixed(2)} meters</span>
          </div>
          <input
            type="range"
            min="0.15"
            max="0.80"
            step="0.05"
            value={maxDriftM}
            onChange={(e) => setMaxDriftM(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
            <span>0.15m (Dead-reckoned)</span>
            <span>0.40m (Nominal)</span>
            <span>0.80m (Rough Seas)</span>
          </div>
        </div>
      </div>

      {/* Comparison Grid: Genuine Marine Obstacle vs Transient Water Column Clutter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Genuine Persistent Hazard Card */}
        <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>GENUINE MARINE OBSTACLE (Track TRK-0001)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                PASSED TEMPORAL CHECK
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300 mt-3">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Consecutive Ping Hit Streak:</span>
                <span className="text-emerald-300 font-bold">14 consecutive hits (≥ {minStreak} required)</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Spatial Drift (AUV-Compensated):</span>
                <span className="text-emerald-300 font-bold">Δd = 0.12m (&lt; {maxDriftM.toFixed(2)}m tolerance)</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Shadow Aspect Variation:</span>
                <span className="text-emerald-300 font-bold">Matches physical grazing angle L(t)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-bold text-center text-xs font-mono">
            CLASSIFICATION: VERIFIED STATIONARY HAZARD (GHOST NET)
          </div>
        </div>

        {/* Transient Clutter Card */}
        <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-400">
                <XCircle className="w-4 h-4" />
                <span>TRANSIENT NOISE SPIKE (Track TRK-0006)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                REJECTED BY TEMPORAL CHECK
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300 mt-3">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Consecutive Ping Hit Streak:</span>
                <span className="text-rose-400 font-bold">1 isolated hit (&lt; {minStreak} required)</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Spatial Drift (AUV-Compensated):</span>
                <span className="text-rose-400 font-bold">Δd = 2.94m (Drifting target)</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Persistence on Next Ping:</span>
                <span className="text-rose-400 font-bold">Vanished on Ping N+1 (Miss streak 1)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 font-bold text-center text-xs font-mono">
            CLASSIFICATION: REJECTED AS TRANSIENT WATER COLUMN ARTIFACT
          </div>
        </div>
      </div>

      {/* Ping Water History Log */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-mono font-bold text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Sequential Ping Tracking Audit Trail</span>
          </h3>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTrackFilter('all')}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${
                activeTrackFilter === 'all' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Tracks
            </button>
            <button
              onClick={() => setActiveTrackFilter('persistent')}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${
                activeTrackFilter === 'persistent' ? 'bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              Persistent Only
            </button>
            <button
              onClick={() => setActiveTrackFilter('transient')}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${
                activeTrackFilter === 'transient' ? 'bg-rose-950/80 text-rose-300 font-bold border border-rose-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              Transient Only
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-2">Ping #</th>
                <th className="p-2">UTC Time</th>
                <th className="p-2">Track ID</th>
                <th className="p-2">Candidate Label</th>
                <th className="p-2">Hit Streak</th>
                <th className="p-2">Spatial Drift</th>
                <th className="p-2">Temporal Status</th>
                <th className="p-2">Tracking Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredHistory.map((h) => {
                const isCurrent = h.ping === simulatedPing;
                return (
                  <tr key={`${h.ping}-${h.trackId}`} className={isCurrent ? 'bg-cyan-950/40' : 'hover:bg-slate-900/50'}>
                    <td className="p-2 font-bold text-cyan-400">#{h.ping}</td>
                    <td className="p-2 text-slate-400">{h.timestamp}</td>
                    <td className="p-2 font-bold text-purple-300">{h.trackId}</td>
                    <td className="p-2 text-slate-300">{h.targetName}</td>
                    <td className="p-2 font-bold">
                      <span className={h.hitStreak >= minStreak ? 'text-emerald-400' : 'text-rose-400'}>
                        {h.hitStreak} hits
                      </span>
                    </td>
                    <td className="p-2 font-mono">
                      <span className={h.spatialDrift <= maxDriftM ? 'text-cyan-300' : 'text-rose-400'}>
                        {h.spatialDrift.toFixed(2)}m
                      </span>
                    </td>
                    <td className="p-2">
                      {h.isPersistent ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          VERIFIED PERSISTENT
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          TRANSIENT REJECTED
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-slate-300 text-[11px]">{h.note}</td>
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
