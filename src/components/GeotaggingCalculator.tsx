import React, { useState } from 'react';
import { 
  Navigation, 
  MapPin, 
  Compass, 
  ArrowUpRight, 
  CheckCircle2, 
  FileCode,
  RotateCcw
} from 'lucide-react';
import { SonarMissionTelemetry, SonarTarget } from '../types/sonar';

interface GeotaggingCalculatorProps {
  telemetry: SonarMissionTelemetry;
  selectedTarget: SonarTarget | null;
}

export const GeotaggingCalculator: React.FC<GeotaggingCalculatorProps> = ({
  telemetry,
  selectedTarget,
}) => {
  const [auvLat, setAuvLat] = useState<number>(selectedTarget ? selectedTarget.latitude : 9.1842);
  const [auvLon, setAuvLon] = useState<number>(selectedTarget ? selectedTarget.longitude : 79.1245);
  const [headingDeg, setHeadingDeg] = useState<number>(telemetry.headingDeg || 142.4);
  const [laybackM, setLaybackM] = useState<number>(15.0);
  const [groundRangeRg, setGroundRangeRg] = useState<number>(selectedTarget ? selectedTarget.groundRangeRg : 18.5);
  const [swathSide, setSwathSide] = useState<'starboard' | 'port'>('starboard');

  // WGS-84 coordinate transformation calculation
  const headingRad = (headingDeg * Math.PI) / 180.0;
  const dNorthTowfish = -laybackM * Math.cos(headingRad);
  const dEastTowfish = -laybackM * Math.sin(headingRad);

  const bearingRad = swathSide === 'starboard' 
    ? headingRad + Math.PI / 2.0 
    : headingRad - Math.PI / 2.0;

  const dNorthTarget = dNorthTowfish + groundRangeRg * Math.cos(bearingRad);
  const dEastTarget = dEastTowfish + groundRangeRg * Math.sin(bearingRad);

  const metersPerLatDeg = 111132.954;
  const metersPerLonDeg = 111412.84 * Math.cos((auvLat * Math.PI) / 180.0);

  const targetLat = auvLat + dNorthTarget / metersPerLatDeg;
  const targetLon = auvLon + dEastTarget / metersPerLonDeg;

  return (
    <div id="geotagging-calculator-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              FLOWCHART NODE 8
            </span>
            <span className="text-xs font-mono text-slate-400">
              Acoustic Geotagging & Orthogonal Coordinate Transformation Engine
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            Towfish Layback & Across-Track Geodetic Positioning
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
            Calculates exact WGS-84 coordinates by taking vehicle navigation (GPS, Gyro heading, Towfish layback) and projecting the target's physical across-track ground range (Rg) orthogonal to the sensor track.
          </p>
        </div>

        <button
          onClick={() => {
            setAuvLat(selectedTarget ? selectedTarget.latitude : 9.1842);
            setAuvLon(selectedTarget ? selectedTarget.longitude : 79.1245);
            setHeadingDeg(telemetry.headingDeg || 142.4);
            setLaybackM(15.0);
            setGroundRangeRg(18.5);
            setSwathSide('starboard');
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-cyan-400 bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Telemetry
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sliders & Controls */}
        <div className="lg:col-span-6 space-y-4 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h3 className="font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
            <Navigation className="w-4 h-4 text-cyan-400" />
            Sensor Navigation Telemetry Parameters
          </h3>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Towfish Layback Distance (L_layback):</span>
              <span className="text-cyan-400 font-bold">{laybackM.toFixed(1)} m behind GPS</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="60.0"
              step="1.0"
              value={laybackM}
              onChange={(e) => setLaybackM(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>AUV Gyro Heading:</span>
              <span className="text-amber-400 font-bold">{headingDeg.toFixed(0)}° True North</span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              step="1"
              value={headingDeg}
              onChange={(e) => setHeadingDeg(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Target Ground Range (R_g):</span>
              <span className="text-indigo-400 font-bold">{groundRangeRg.toFixed(1)} m</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="60.0"
              step="0.5"
              value={groundRangeRg}
              onChange={(e) => setGroundRangeRg(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Sonar Channel Side:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSwathSide('port')}
                className={`py-2 px-3 rounded-lg border font-bold cursor-pointer transition-colors ${
                  swathSide === 'port'
                    ? 'bg-rose-950 border-rose-500 text-rose-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                PORT (-90° Port Track)
              </button>
              <button
                type="button"
                onClick={() => setSwathSide('starboard')}
                className={`py-2 px-3 rounded-lg border font-bold cursor-pointer transition-colors ${
                  swathSide === 'starboard'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                STARBOARD (+90° Stbd Track)
              </button>
            </div>
          </div>
        </div>

        {/* Calculated Geodetic Fix Display */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs font-mono">
            <h3 className="font-bold text-cyan-400 flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Calculated Target WGS-84 Geodetic Coordinates
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block mb-0.5">TARGET LATITUDE (WGS-84)</span>
                <span className="text-lg font-bold text-white font-mono">{targetLat.toFixed(7)}° N</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block mb-0.5">TARGET LONGITUDE (WGS-84)</span>
                <span className="text-lg font-bold text-white font-mono">{targetLon.toFixed(7)}° E</span>
              </div>
            </div>

            <div className="space-y-2 text-slate-300 text-xs">
              <div className="flex justify-between p-2 rounded bg-slate-900/60">
                <span className="text-slate-400">Total North Offset (Δy):</span>
                <span className="font-bold text-slate-200">{dNorthTarget >= 0 ? `+${dNorthTarget.toFixed(2)}` : dNorthTarget.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900/60">
                <span className="text-slate-400">Total East Offset (Δx):</span>
                <span className="font-bold text-slate-200">{dEastTarget >= 0 ? `+${dEastTarget.toFixed(2)}` : dEastTarget.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900/60">
                <span className="text-slate-400">Target Bearing from AUV GPS:</span>
                <span className="font-bold text-amber-300">
                  {((Math.atan2(dEastTarget, dNorthTarget) * 180.0 / Math.PI + 360) % 360).toFixed(1)}° True
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400 font-bold block mb-1">✓ Automated GeoJSON Generation</span>
            Coordinates are automatically injected into Node 8 GeoJSON outputs, feeding surface salvage vessels, autonomous ROV recovery arms, and port authority hazard warnings.
          </div>
        </div>
      </div>
    </div>
  );
};
