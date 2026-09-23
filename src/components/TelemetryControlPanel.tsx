import React, { useState } from 'react';
import { 
  Sliders, 
  Upload, 
  RotateCcw, 
  Compass, 
  Activity, 
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { SonarMissionTelemetry, PreprocessingParams, SonarTarget } from '../types/sonar';

interface TelemetryControlPanelProps {
  telemetry: SonarMissionTelemetry;
  setTelemetry: React.Dispatch<React.SetStateAction<SonarMissionTelemetry>>;
  preprocessingParams: PreprocessingParams;
  setPreprocessingParams: React.Dispatch<React.SetStateAction<PreprocessingParams>>;
  onResetDefaults: () => void;
  onCustomImageUploaded: (file: File) => void;
  onLoadPreset: (presetKey: string) => void;
}

export const TelemetryControlPanel: React.FC<TelemetryControlPanelProps> = ({
  telemetry,
  setTelemetry,
  preprocessingParams,
  setPreprocessingParams,
  onResetDefaults,
  onCustomImageUploaded,
  onLoadPreset,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onCustomImageUploaded(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCustomImageUploaded(e.target.files[0]);
    }
  };

  return (
    <div id="telemetry-control-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg text-xs font-mono">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-white text-sm">Sonar Telemetry & Physics Tuning</h3>
        </div>
        <button
          onClick={onResetDefaults}
          className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Calibrations
        </button>
      </div>

      <div className="space-y-4">
        {/* Preset Mission Switcher */}
        <div>
          <label className="text-slate-400 block mb-1 text-[11px]">Mission Sonar Log Preset:</label>
          <select
            onChange={(e) => onLoadPreset(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="gulf_mannar">Mission 08 - Gulf of Mannar (Ghost Net Highlight + Flat Rock)</option>
            <option value="shallow_trawler">Mission 14 - Coastal Shoal (Entangled Gillnet & Trawler Winch)</option>
            <option value="deep_channel">Mission 22 - Continental Shelf (Deep Debris Drum & Cages)</option>
          </select>
        </div>

        {/* 1. Sensor Altitude H */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>AUV Altitude (H):</span>
            <span className="text-cyan-400 font-bold">{telemetry.auvAltitudeH.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min="4.0"
            max="25.0"
            step="0.5"
            value={telemetry.auvAltitudeH}
            onChange={(e) =>
              setTelemetry((prev) => ({ ...prev, auvAltitudeH: parseFloat(e.target.value) }))
            }
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
            <span>4.0m (Shallow)</span>
            <span>25.0m (Deep)</span>
          </div>
        </div>

        {/* 2. TVG Spreading Loss */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>TVG Spreading Factor:</span>
            <span className="text-amber-400 font-bold">{preprocessingParams.tvgSpreadingFactor} dB</span>
          </div>
          <input
            type="range"
            min="20"
            max="45"
            step="1"
            value={preprocessingParams.tvgSpreadingFactor}
            onChange={(e) =>
              setPreprocessingParams((prev) => ({
                ...prev,
                tvgSpreadingFactor: parseInt(e.target.value),
              }))
            }
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* 3. Seawater Absorption Alpha */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Absorption Coeff (α):</span>
            <span className="text-amber-400 font-bold">{preprocessingParams.absorptionAlpha} dB/km</span>
          </div>
          <input
            type="range"
            min="40"
            max="180"
            step="5"
            value={preprocessingParams.absorptionAlpha}
            onChange={(e) =>
              setPreprocessingParams((prev) => ({
                ...prev,
                absorptionAlpha: parseInt(e.target.value),
              }))
            }
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* 4. Speckle Noise Filter Strength */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Homomorphic Filter:</span>
            <span className="text-sky-400 font-bold">
              {Math.round(preprocessingParams.speckleStrength * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={preprocessingParams.speckleStrength}
            onChange={(e) =>
              setPreprocessingParams((prev) => ({
                ...prev,
                speckleStrength: parseFloat(e.target.value),
              }))
            }
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        {/* 5. 3D Risk Gate Rejection Floor */}
        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="flex justify-between text-slate-300 mb-1">
            <span className="text-rose-300 font-semibold">Min Hazard Height (h_min):</span>
            <span className="text-rose-400 font-bold">
              {preprocessingParams.minHeightThreshold.toFixed(2)} m
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.80"
            step="0.05"
            value={preprocessingParams.minHeightThreshold}
            onChange={(e) =>
              setPreprocessingParams((prev) => ({
                ...prev,
                minHeightThreshold: parseFloat(e.target.value),
              }))
            }
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="text-[10px] text-slate-400 mt-1 leading-tight">
            Objects with physical height &lt; {preprocessingParams.minHeightThreshold.toFixed(2)}m
            are immediately rejected as flat rock/sand ripples.
          </div>
        </div>

        {/* Upload Custom Sonar Image */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
            isDragOver
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-slate-800 bg-slate-950 hover:border-slate-700'
          }`}
        >
          <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1.5" />
          <div className="text-slate-300 font-semibold text-[11px]">Upload Custom Sonar Log</div>
          <p className="text-[10px] text-slate-500 mb-2">Drag & drop raw SSS .png / .jpg</p>
          <label className="inline-block px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer">
            Browse File
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
