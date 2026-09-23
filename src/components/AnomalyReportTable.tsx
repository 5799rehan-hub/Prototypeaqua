import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  FileJson,
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Search,
  Copy,
  Check,
  Eye,
  X,
  Mail,
  Clock,
  Zap,
  Activity
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

interface AnomalyReportTableProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
  onDispatchGmailAlert?: (target: SonarTarget) => void;
}

export const AnomalyReportTable: React.FC<AnomalyReportTableProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
  onDispatchGmailAlert,
}) => {
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'repdnet_rejected' | 'temporal_rejected'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [copiedCoordId, setCopiedCoordId] = useState<string | null>(null);

  const filteredTargets = targets.filter((tgt) => {
    if (filter === 'confirmed' && tgt.status !== 'CONFIRMED_HAZARD') return false;
    if (filter === 'repdnet_rejected') {
      if (tgt.status === 'CONFIRMED_HAZARD' || tgt.temporalStatus === 'REJECTED_TRANSIENT') return false;
    }
    if (filter === 'temporal_rejected') {
      if (tgt.temporalStatus !== 'REJECTED_TRANSIENT') return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        tgt.id.toLowerCase().includes(q) ||
        tgt.name.toLowerCase().includes(q) ||
        tgt.type.toLowerCase().includes(q) ||
        tgt.temporalTrackId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Generate standardized JSON representation of mission and detections
  const getDetectionJsonData = () => {
    return {
      mission_metadata: {
        system: "AQUAGHOST",
        model: "RepDNet Physics-Informed Model & Multi-Ping Temporal Check",
        mission_id: telemetry.missionId,
        location: telemetry.locationName,
        auv_altitude_meters: telemetry.auvAltitudeH,
        max_slant_range_meters: telemetry.maxSlantRange,
        operating_frequency_khz: telemetry.operatingFrequencyKhz,
        exported_at: new Date().toISOString(),
        total_targets: targets.length,
        confirmed_hazards: targets.filter(t => t.status === 'CONFIRMED_HAZARD').length,
      },
      detections: targets.map((t) => ({
        target_id: t.id,
        classification: t.name,
        type: t.type,
        pipeline_status: t.status,
        is_confirmed_hazard: t.status === 'CONFIRMED_HAZARD',
        repdnet_physics_score_pct: t.repdnetPhysicsScore,
        repdnet_loss: t.repdnetLoss,
        repdnet_eeb_edge_gradient: t.repdnetEebEdgeGradient,
        repdnet_psb_noise_reduction_db: t.repdnetPsbNoiseReductionDb,
        temporal_track_id: t.temporalTrackId,
        temporal_status: t.temporalStatus,
        temporal_hit_streak: t.temporalHitStreak,
        temporal_spatial_drift_m: t.temporalSpatialDriftM,
        latitude: t.latitude,
        longitude: t.longitude,
        depth_meters: t.depthMeters,
        calculated_3d_height_meters: t.calculatedHeight,
        height_uncertainty_meters: t.heightUncertainty,
        ground_range_rg_meters: t.groundRangeRg,
        shadow_length_l_meters: t.shadowLengthL,
        ai_confidence_pct: +(t.aiConfidence * 100).toFixed(1),
        fused_risk_score_pct: t.fusedRiskScore,
        ping_index: t.pingIndex,
        timestamp_utc: t.timestamp,
        rejection_reason: t.rejectionReason || null,
      })),
    };
  };

  // Export structured JSON
  const handleExportJSON = () => {
    const data = getDetectionJsonData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AQUAGHOST_RepDNet_Audit_${telemetry.missionId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export structured CSV
  const handleExportCSV = () => {
    const headers = [
      'Target_ID',
      'Classification',
      'Pipeline_Status',
      'RepDNet_Physics_Score_pct',
      'Temporal_Status',
      'Temporal_Hit_Streak',
      'Spatial_Drift_m',
      'Calculated_3D_Height_m',
      'Shadow_Length_L_m',
      'Ground_Range_Rg_m',
      'AI_Confidence_pct',
      'Fused_Marine_Risk_pct',
      'Latitude',
      'Longitude',
      'Water_Depth_m',
      'Sensor_Altitude_H_m',
      'Ping_Index',
      'Timestamp_UTC',
      'Rejection_Reason',
    ];

    const rows = targets.map((t) => [
      t.id,
      `"${t.name}"`,
      t.status,
      t.repdnetPhysicsScore,
      t.temporalStatus,
      t.temporalHitStreak,
      t.temporalSpatialDriftM.toFixed(2),
      t.calculatedHeight.toFixed(3),
      t.shadowLengthL.toFixed(2),
      t.groundRangeRg.toFixed(2),
      (t.aiConfidence * 100).toFixed(1),
      t.fusedRiskScore,
      t.latitude.toFixed(6),
      t.longitude.toFixed(6),
      t.depthMeters,
      telemetry.auvAltitudeH,
      t.pingIndex,
      t.timestamp,
      `"${t.rejectionReason || 'None - Confirmed Hazard'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AQUAGHOST_RepDNet_Audit_${telemetry.missionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export structured GeoJSON
  const handleExportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      mission_metadata: {
        system: "AQUAGHOST",
        model: "RepDNet Physics-Informed Model & Multi-Ping Temporal Check",
        mission_id: telemetry.missionId,
        location: telemetry.locationName,
        auv_altitude_h_m: telemetry.auvAltitudeH,
        max_slant_range_m: telemetry.maxSlantRange,
        frequency_khz: telemetry.operatingFrequencyKhz,
        exported_at: new Date().toISOString(),
      },
      features: targets.map((t) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [t.longitude, t.latitude, -t.depthMeters],
        },
        properties: {
          target_id: t.id,
          name: t.name,
          status: t.status,
          is_hazard: t.status === 'CONFIRMED_HAZARD',
          repdnet_physics_score: t.repdnetPhysicsScore,
          temporal_status: t.temporalStatus,
          temporal_hit_streak: t.temporalHitStreak,
          temporal_spatial_drift_m: t.temporalSpatialDriftM,
          latitude: t.latitude,
          longitude: t.longitude,
          calculated_3d_height_m: t.calculatedHeight,
          height_uncertainty_m: t.heightUncertainty,
          ground_range_rg_m: t.groundRangeRg,
          shadow_length_m: t.shadowLengthL,
          ai_confidence: t.aiConfidence,
          fused_risk_score: t.fusedRiskScore,
          ping_index: t.pingIndex,
          timestamp: t.timestamp,
          rejection_reason: t.rejectionReason || null,
        },
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `AQUAGHOST_RepDNet_GeoTags_${telemetry.missionId}.geojson`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCoord = (tgt: SonarTarget) => {
    navigator.clipboard.writeText(`${tgt.latitude.toFixed(6)}, ${tgt.longitude.toFixed(6)}`);
    setCopiedCoordId(tgt.id);
    setTimeout(() => setCopiedCoordId(null), 2000);
  };

  const handleCopyJsonToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(getDetectionJsonData(), null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div id="anomaly-reporting-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      {/* Title & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              FLOWCHART NODE 8
            </span>
            <span className="text-xs font-mono text-slate-400">
              Anomalous Reporting & Geotagging Engine
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
            RepDNet & Temporal Check Anomaly Audit Log
          </h2>
        </div>

        {/* Export Buttons: JSON, CSV, GeoJSON, View JSON */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="export-json-btn"
            onClick={handleExportJSON}
            title="Download full detection data as JSON format"
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm shadow-amber-950"
          >
            <FileJson className="w-3.5 h-3.5" />
            Download JSON
          </button>

          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            title="Download detection audit log as CSV format"
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm shadow-emerald-950"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Download CSV
          </button>

          <button
            id="export-geojson-btn"
            onClick={handleExportGeoJSON}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-700 hover:bg-cyan-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm shadow-cyan-950"
          >
            <FileCode className="w-3.5 h-3.5" />
            Download GeoJSON
          </button>

          <button
            id="view-json-modal-btn"
            onClick={() => setShowJsonModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            View JSON Output
          </button>

          {onDispatchGmailAlert && (
            <button
              id="dispatch-gmail-alert-btn"
              onClick={() => onDispatchGmailAlert(selectedTarget || targets.find(t => t.status === 'CONFIRMED_HAZARD') || targets[0])}
              title="Open Gmail Dispatcher with Selected Target"
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-rose-700 hover:bg-rose-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm shadow-rose-950"
            >
              <Mail className="w-3.5 h-3.5" />
              Gmail Threat Alert
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-800 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Detections ({targets.length})
          </button>
          <button
            onClick={() => setFilter('confirmed')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              filter === 'confirmed'
                ? 'bg-rose-950 text-rose-300 font-semibold border border-rose-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Confirmed Hazards ({targets.filter((t) => t.status === 'CONFIRMED_HAZARD').length})
          </button>
          <button
            onClick={() => setFilter('repdnet_rejected')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              filter === 'repdnet_rejected'
                ? 'bg-slate-800 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RepDNet Rejected: Flat Rock ({targets.filter((t) => t.status === 'REJECTED_FALSE_POSITIVE' && t.temporalStatus !== 'REJECTED_TRANSIENT').length})
          </button>
          <button
            onClick={() => setFilter('temporal_rejected')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              filter === 'temporal_rejected'
                ? 'bg-slate-800 text-indigo-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Temporal Check Rejected: Transient ({targets.filter((t) => t.temporalStatus === 'REJECTED_TRANSIENT').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ID, name, track..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono w-64"
          />
        </div>
      </div>

      {/* Target Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Target ID</th>
              <th className="py-2.5 px-3">Classification</th>
              <th className="py-2.5 px-3">Pipeline Decision</th>
              <th className="py-2.5 px-3">RepDNet Physics Gate</th>
              <th className="py-2.5 px-3">Temporal Check Gate</th>
              <th className="py-2.5 px-3 text-cyan-300">GPS Coordinates</th>
              <th className="py-2.5 px-3">3D Height (h)</th>
              <th className="py-2.5 px-3">Risk Score</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredTargets.map((tgt) => {
              const isConfirmed = tgt.status === 'CONFIRMED_HAZARD';
              const isSelected = selectedTarget?.id === tgt.id;
              const repdnetPass = tgt.repdnetPhysicsScore >= 50 && tgt.calculatedHeight >= 0.20;
              const temporalPass = tgt.temporalStatus === 'VERIFIED_PERSISTENT';

              return (
                <tr
                  key={tgt.id}
                  onClick={() => onSelectTarget(tgt)}
                  className={`hover:bg-slate-900/70 transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-950/20 border-l-2 border-amber-400' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                    {tgt.id}
                    <div className="text-[10px] text-slate-500 font-normal">{tgt.temporalTrackId}</div>
                  </td>
                  <td className="py-2.5 px-3 max-w-xs truncate">
                    <div className="font-semibold text-slate-200">{tgt.name}</div>
                    <div className="text-[10px] text-slate-400">{tgt.type.replace('_', ' ')}</div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        HAZARD
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                        <XCircle className="w-2.5 h-2.5" />
                        REJECTED
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {repdnetPass ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className={repdnetPass ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        {tgt.repdnetPhysicsScore}%
                      </span>
                      <span className="text-[10px] text-slate-500">(G={tgt.repdnetEebEdgeGradient.toFixed(2)})</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {temporalPass ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className={temporalPass ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                        {tgt.temporalHitStreak} hits
                      </span>
                      <span className="text-[10px] text-slate-500">(Δd={tgt.temporalSpatialDriftM.toFixed(2)}m)</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-bold text-cyan-300">
                    <div>{tgt.latitude.toFixed(6)}° N</div>
                    <div className="text-slate-400 text-[10px]">{tgt.longitude.toFixed(6)}° E</div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-bold">
                    <span className={isConfirmed ? 'text-rose-400' : 'text-slate-400'}>
                      {tgt.calculatedHeight.toFixed(2)}m
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal"> (±{tgt.heightUncertainty.toFixed(2)}m)</span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`font-bold text-sm ${isConfirmed ? 'text-rose-400' : 'text-slate-500'}`}>
                      {tgt.fusedRiskScore}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-right">
                    {onDispatchGmailAlert && isConfirmed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDispatchGmailAlert(tgt);
                        }}
                        title="Dispatch Gmail Threat Alert for this Target"
                        className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 inline-flex items-center gap-1 cursor-pointer font-semibold mr-1.5"
                      >
                        <Mail className="w-3 h-3 text-rose-400" />
                        <span className="text-[10px]">Email</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyCoord(tgt);
                      }}
                      title="Copy Lat/Lon"
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-cyan-300 border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCoordId === tgt.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[10px]">{copiedCoordId === tgt.id ? 'Copied' : 'GPS'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* JSON Viewer Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm font-mono">
                  RepDNet & Temporal Check JSON Output Structure
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJsonToClipboard}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={() => setShowJsonModal(false)}
                  className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950 flex-1">
              <pre>{JSON.stringify(getDetectionJsonData(), null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
