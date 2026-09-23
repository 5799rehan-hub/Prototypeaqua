import React from 'react';
import { 
  Waves, 
  Cpu, 
  ShieldCheck, 
  Anchor, 
  Activity, 
  Zap, 
  Database,
  Radio,
  Layers,
  Clock,
  MapPin,
  FileCode,
  Download,
  FileSpreadsheet,
  FileJson,
  Mail,
  Eye
} from 'lucide-react';
import { SonarMissionTelemetry, WorkspaceMode } from '../types/sonar';

export type ActiveTabType = 
  | 'waterfall' 
  | 'parallel_heads' 
  | 'temporal' 
  | 'shadow_analysis'
  | 'physics3d' 
  | 'geotag' 
  | 'map' 
  | 'reports' 
  | 'code'
  | 'gmail';

interface HeaderProps {
  telemetry: SonarMissionTelemetry;
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  onRunDetection: () => void;
  isProcessing: boolean;
  onExportReport?: (format: 'json' | 'csv') => void;
  onViewJSON?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  activeTab,
  setActiveTab,
  workspaceMode,
  setWorkspaceMode,
  onRunDetection,
  isProcessing,
  onExportReport,
  onViewJSON,
}) => {
  return (
    <header id="aquaghost-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      {/* Top Banner: Brand & Edge Telemetry */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950">
            <Waves className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-semibold">
                AUTONOMOUS OCEAN RECON
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                OFFLINE EDGE NATIVE
              </span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              AQUAGHOST
              <span className="text-xs font-normal text-slate-400 hidden sm:inline">
                | RepDNet Physics-Informed Model & Temporal Check Pipeline
              </span>
            </h1>
          </div>
        </div>

        {/* 2 Dedicated Spaces Switcher: Live Sonar Scan vs Upload & Analyze */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner text-xs font-mono">
          <button
            id="mode-live-btn"
            onClick={() => setWorkspaceMode('live')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              workspaceMode === 'live'
                ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${workspaceMode === 'live' ? 'bg-emerald-300 animate-ping' : 'bg-slate-500'}`} />
            <span>SPACE 1: LIVE SONAR SCAN</span>
          </button>

          <button
            id="mode-upload-btn"
            onClick={() => setWorkspaceMode('upload')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              workspaceMode === 'upload'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${workspaceMode === 'upload' ? 'bg-purple-300 animate-pulse' : 'bg-slate-500'}`} />
            <span>SPACE 2: UPLOAD & ANALYZE</span>
          </button>
        </div>

        {/* Jetson & Sonar Live Telemetry Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Jetson:</span>
            <span className="text-amber-300 font-medium">{telemetry.jetsonPowerWatts}W @ {telemetry.fps} FPS</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-slate-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Freq:</span>
            <span className="text-cyan-300 font-medium">{telemetry.operatingFrequencyKhz} kHz</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-slate-300">
            <Anchor className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Alt (H):</span>
            <span className="text-sky-300 font-medium">{telemetry.auvAltitudeH.toFixed(1)}m</span>
          </div>

          <button
            id="run-pipeline-btn"
            onClick={onRunDetection}
            disabled={isProcessing}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              isProcessing
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/50 cursor-pointer active:scale-95'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing Pings...' : 'Run RepDNet Pipeline'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs covering the complete 9-node architecture */}
      <div className="max-w-7xl mx-auto px-4 border-t border-slate-800/80 flex items-center justify-between overflow-x-auto text-sm gap-2">
        <nav className="flex space-x-1 py-1" aria-label="Pipeline Views">
          <button
            id="tab-water"
            onClick={() => setActiveTab('waterfall')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'waterfall'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            1. Water & Preprocessing (Nodes 1-2)
          </button>

          <button
            id="tab-parallel-heads"
            onClick={() => setActiveTab('parallel_heads')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'parallel_heads'
                ? 'bg-slate-800 text-purple-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            2. Multi-Scale Feature Fusion (Nodes 3-5)
          </button>

          <button
            id="tab-temporal"
            onClick={() => setActiveTab('temporal')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'temporal'
                ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            3. Temporal Check (Node 6)
          </button>

          <button
            id="tab-shadow-analysis"
            onClick={() => setActiveTab('shadow_analysis')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'shadow_analysis'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            4. Shadow Analysis Module
          </button>

          <button
            id="tab-physics3d"
            onClick={() => setActiveTab('physics3d')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'physics3d'
                ? 'bg-slate-800 text-amber-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            5. RepDNet Physics Model (Node 7)
          </button>

          <button
            id="tab-geotag"
            onClick={() => setActiveTab('geotag')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'geotag'
                ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            5. Geotagging Engine (Node 8)
          </button>

          <button
            id="tab-map"
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'map'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            6. Marine Risk Map (Node 9)
          </button>

          <button
            id="tab-reports"
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-sky-400" />
            7. Reports & JSON / CSV
          </button>

          <button
            id="tab-code"
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'code'
                ? 'bg-slate-800 text-purple-400 shadow-sm border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-purple-400" />
            8. Python Codebase Hub
          </button>

          <button
            id="tab-gmail"
            onClick={() => setActiveTab('gmail')}
            className={`px-3 py-1.5 font-medium rounded-md flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap cursor-pointer ${
              activeTab === 'gmail'
                ? 'bg-rose-950/90 text-rose-300 shadow-sm border border-rose-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-rose-400" />
            <span>9. Gmail Alerts & Dispatch</span>
          </button>
        </nav>

        {/* Global JSON and CSV Export Buttons */}
        <div className="flex items-center gap-1.5 py-1 text-xs font-mono shrink-0">
          <button
            onClick={() => {
              const link = document.createElement('a');
              link.href = '/standalone-aquaghost.html';
              link.download = 'index.html';
              link.click();
            }}
            title="Download the 1-File Self-Contained index.html (432 KB) ready to upload to GitHub Pages or run locally"
            className="px-2.5 py-1 rounded bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/70 flex items-center gap-1.5 transition-colors cursor-pointer font-semibold shadow-sm"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span>Download Single-File index.html</span>
          </button>

          {onExportReport && (
            <>
              <button
                onClick={() => onExportReport('json')}
                title="Download Detection Data in JSON Format (with Lat/Lon coordinates)"
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FileJson className="w-3 h-3" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => onExportReport('csv')}
                title="Download Detection Data in CSV Format (with Lat/Lon coordinates)"
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </>
          )}
          {onViewJSON && (
            <button
              onClick={onViewJSON}
              title="View and Copy Raw JSON"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View JSON</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
