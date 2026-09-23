import { getAccessToken } from './firebaseAuth';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  body?: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachmentName?: string;
  attachmentData?: string; // base64 or raw string
}

/**
 * Encodes a string into URL-safe base64 format without padding as required by Gmail API.
 */
function base64UrlEncode(str: string): string {
  // UTF-8 safe base64 encoding
  const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  return btoa(utf8Bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Fetch current user's Gmail profile information.
 */
export async function fetchGmailProfile(): Promise<GmailProfile> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in to access Gmail.');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch Gmail profile: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch a list of message summaries from Gmail.
 */
export async function listGmailMessages(
  query: string = '',
  maxResults: number = 10
): Promise<GmailMessageSummary[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google.');

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('maxResults', maxResults.toString());
  if (query) {
    url.searchParams.set('q', query);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail API error: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.messages || data.messages.length === 0) {
    return [];
  }

  // Fetch details for each message
  const detailedMessages = await Promise.all(
    data.messages.slice(0, maxResults).map(async (msg: { id: string; threadId: string }) => {
      try {
        return await getGmailMessage(msg.id);
      } catch {
        return { id: msg.id, threadId: msg.threadId, snippet: 'Unable to load snippet' };
      }
    })
  );

  return detailedMessages;
}

/**
 * Fetch individual message details by ID.
 */
export async function getGmailMessage(id: string): Promise<GmailMessageSummary> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google.');

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to load message ${id}`);
  }

  const data = await res.json();
  const headers = data.payload?.headers || [];
  
  const getHeader = (name: string) => 
    headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value;

  const subject = getHeader('subject') || '(No Subject)';
  const from = getHeader('from') || 'Unknown Sender';
  const to = getHeader('to') || 'Unknown Recipient';
  const date = getHeader('date') || '';

  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet,
    subject,
    from,
    to,
    date,
  };
}

/**
 * Send an email directly via the user's connected Gmail account.
 */
export async function sendGmailMessage(payload: SendEmailPayload): Promise<{ id: string; threadId: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in to send emails.');

  // Construct MIME message
  const boundary = 'aquaghost_boundary_' + Date.now();
  let rawMessage = '';

  if (payload.bodyHtml) {
    rawMessage = [
      `To: ${payload.to}`,
      `Subject: =?utf-8?B?${btoa(encodeURIComponent(payload.subject).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      payload.bodyText,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      payload.bodyHtml,
      '',
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    rawMessage = [
      `To: ${payload.to}`,
      `Subject: =?utf-8?B?${btoa(encodeURIComponent(payload.subject).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))}?=`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      payload.bodyText,
    ].join('\r\n');
  }

  const encodedRaw = base64UrlEncode(rawMessage);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedRaw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to send email: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Helper to generate a standardized Marine Acoustic Hazard Alert template.
 */
export function generateHazardAlertEmail(
  target: SonarTarget,
  telemetry: SonarMissionTelemetry
): { subject: string; bodyText: string; bodyHtml: string } {
  const isHazard = target.status === 'CONFIRMED_HAZARD';
  const urgency = isHazard ? 'CRITICAL - HIGH RISK' : 'ADVISORY - ACOUSTIC DETECTION';
  const subject = `[AQUAGHOST ALERT] ${urgency}: ${target.name} (${target.id}) at ${target.latitude.toFixed(5)}°N, ${target.longitude.toFixed(5)}°E`;

  const mapUrl = `https://www.google.com/maps?q=${target.latitude.toFixed(6)},${target.longitude.toFixed(6)}`;

  const bodyText = `
AQUAGHOST ACOUSTIC HAZARD ALERT - AUTOMATED TELEMETRY REPORT
============================================================
Timestamp: ${new Date().toUTCString()}
Mission ID: ${telemetry.missionId} (${telemetry.locationName})
Sensor: Side-Scan Sonar @ ${telemetry.operatingFrequencyKhz} kHz (AUV Alt: ${telemetry.auvAltitudeH}m)

TARGET ASSESSMENT:
- Target ID: ${target.id}
- Classification: ${target.name} (${target.type})
- Physics Gate Status: ${target.status}
- Marine Entanglement Risk: ${target.fusedRiskScore}%
- AI Classification Confidence: ${(target.aiConfidence * 100).toFixed(1)}%

3D ACOUSTICAL GEOMETRY:
- Calculated 3D Height (h): ${target.calculatedHeight.toFixed(2)} m (±${target.heightUncertainty.toFixed(2)} m)
- Acoustic Shadow Length (L): ${target.shadowLengthL.toFixed(2)} m
- Ground Range (Rg): ${target.groundRangeRg.toFixed(2)} m
- Water Column Depth: ${target.depthMeters.toFixed(1)} m
- Object Dimensions: ~${target.objectLength.toFixed(1)}m (L) x ${target.objectWidth.toFixed(1)}m (W)

GEOGRAPHIC POSITION:
- Latitude: ${target.latitude.toFixed(6)}° N
- Longitude: ${target.longitude.toFixed(6)}° E
- Google Maps Location: ${mapUrl}

OPERATIONAL RECOMMENDATION:
${isHazard 
  ? 'IMMEDIATE ACTION REQUIRED: Confirmed acoustic signature of derelict fishing gear (ghost net). Risk of marine life entanglement or vessel propulsion fouling. Deploy ROV recovery team or issue Notice to Mariners.'
  : 'MONITORING ADVISORY: Target does not meet minimum acoustic elevation threshold for ghost net entanglement; logged as natural benthic feature.'}

Report automatically dispatched via AQUAGHOST Edge Marine Sonar Pipeline.
`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background: #0f172a; color: #ffffff; padding: 20px; border-bottom: 4px solid ${isHazard ? '#f43f5e' : '#0ea5e9'}; }
    .title { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
    .subtitle { font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; font-family: monospace; text-transform: uppercase; background: ${isHazard ? '#ffe4e6' : '#e0f2fe'}; color: ${isHazard ? '#e11d48' : '#0284c7'}; margin-top: 10px; }
    .content { padding: 24px; }
    .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .metric-box { background: #f1f5f9; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-family: monospace; }
    .metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; }
    .metric-val { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .alert-box { background: ${isHazard ? '#fff1f2' : '#f0fdf4'}; border-left: 4px solid ${isHazard ? '#f43f5e' : '#22c55e'}; padding: 14px; border-radius: 4px; margin: 16px 0; font-size: 13px; color: ${isHazard ? '#881337' : '#14532d'}; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">🌊 AQUAGHOST Marine Acoustic Threat Alert</div>
      <div class="subtitle">Side-Scan Sonar AI & Acoustic Physics Risk Engine | Mission: ${telemetry.missionId}</div>
      <span class="badge">${isHazard ? '🚨 CONFIRMED GHOST NET HAZARD' : 'ℹ️ BENTHIC ACOUSTIC LOG'}</span>
    </div>
    <div class="content">
      <h3 style="margin-top:0; font-size:16px;">Target: ${target.name} (${target.id})</h3>
      <p style="font-size:13px; color:#475569;">
        Acoustic shadow trigonometry and GhostNetV2 parallel heads have classified a high-backscatter seabed anomaly at <strong>${telemetry.locationName}</strong>.
      </p>

      <div class="metric-grid">
        <div class="metric-box">
          <div class="metric-label">Calculated 3D Height (h)</div>
          <div class="metric-val" style="color: ${isHazard ? '#e11d48' : '#0284c7'}">${target.calculatedHeight.toFixed(2)} m <span style="font-size:11px; color:#64748b;">(±${target.heightUncertainty.toFixed(2)}m)</span></div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Entanglement Risk Score</div>
          <div class="metric-val" style="color: ${target.fusedRiskScore > 70 ? '#e11d48' : '#eab308'}">${target.fusedRiskScore}%</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Acoustic Shadow Length (L)</div>
          <div class="metric-val">${target.shadowLengthL.toFixed(1)} m</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Seabed Depth</div>
          <div class="metric-val">${target.depthMeters.toFixed(1)} m</div>
        </div>
      </div>

      <div class="alert-box">
        <strong>Status: ${target.status}</strong><br>
        ${isHazard 
          ? 'Physics-grounded verification confirmed positive 3D relief above the seabed floor. High risk of entangling cetaceans, pinnipeds, or commercial fishing gear.' 
          : 'Physics gate rejected target: elevation relief is below acoustic hazard threshold (flat benthic strata).'}
      </div>

      <div style="margin-top:16px;">
        <p style="font-size:12px; margin-bottom:6px; color:#64748b; font-family:monospace;">
          GPS COORDINATES: <strong>${target.latitude.toFixed(6)}° N, ${target.longitude.toFixed(6)}° E</strong>
        </p>
        <a href="${mapUrl}" target="_blank" class="btn">View Target Location on Map ↗</a>
      </div>
    </div>
    <div class="footer">
      Dispatched by AQUAGHOST Edge Sonar System &bull; Sensor: ${telemetry.operatingFrequencyKhz}kHz &bull; Slant Range: ${telemetry.maxSlantRange}m
    </div>
  </div>
</body>
</html>
`;

  return { subject, bodyText, bodyHtml };
}
