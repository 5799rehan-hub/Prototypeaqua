import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  LogOut, 
  RefreshCw, 
  Inbox, 
  Eye, 
  ShieldAlert, 
  FileJson, 
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  Info,
  Check,
  X
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from '../services/firebaseAuth';
import { 
  fetchGmailProfile, 
  sendGmailMessage, 
  listGmailMessages, 
  generateHazardAlertEmail,
  GmailProfile,
  GmailMessageSummary,
  SendEmailPayload
} from '../services/gmailService';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

interface GmailHazardDispatcherProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
}

export const GmailHazardDispatcher: React.FC<GmailHazardDispatcherProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [gmailProfile, setGmailProfile] = useState<GmailProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'hazard_alert' | 'custom_email' | 'inbox'>('hazard_alert');

  // Form State for Hazard Alert
  const [targetToAlert, setTargetToAlert] = useState<SonarTarget>(
    selectedTarget || targets.find(t => t.status === 'CONFIRMED_HAZARD') || targets[0]
  );
  const [recipientPreset, setRecipientPreset] = useState<string>('coastguard');
  const [customRecipient, setCustomRecipient] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [includeJsonAttachment, setIncludeJsonAttachment] = useState<boolean>(true);

  // Custom Email Form State
  const [customTo, setCustomTo] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('AQUAGHOST Marine Sonar Mission Briefing');
  const [customBody, setCustomBody] = useState<string>(
    `Hello,\n\nPlease find attached the acoustic survey telemetry summary from mission ${telemetry.missionId} (${telemetry.locationName}).\n\nTotal Anomaly Detections: ${targets.length}\nConfirmed Ghost Net Hazards: ${targets.filter(t => t.status === 'CONFIRMED_HAZARD').length}\n\nBest regards,\nAQUAGHOST Sonar Recon Unit`
  );

  // Messages log
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [messagesQuery, setMessagesQuery] = useState<string>('AQUAGHOST');
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);

  // Sending and Confirmation State (MANDATORY User Confirmation for Destructive/Mutating Operations)
  const [pendingPayload, setPendingPayload] = useState<SendEmailPayload | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);

  // Update target when prop changes
  useEffect(() => {
    if (selectedTarget) {
      setTargetToAlert(selectedTarget);
    }
  }, [selectedTarget]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setIsAuthLoading(false);
        loadGmailProfile();
      },
      () => {
        setCurrentUser(null);
        setGmailProfile(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadGmailProfile = async () => {
    try {
      const profile = await fetchGmailProfile();
      setGmailProfile(profile);
      loadRecentMessages(messagesQuery);
    } catch (err: any) {
      console.warn('Failed to load Gmail profile:', err);
      setAuthError(err.message || 'Could not connect to Gmail API');
    }
  };

  const loadRecentMessages = async (query: string = '') => {
    setIsLoadingMessages(true);
    try {
      const msgs = await listGmailMessages(query, 8);
      setMessages(msgs);
    } catch (err: any) {
      console.error('Failed to list messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        const profile = await fetchGmailProfile();
        setGmailProfile(profile);
        loadRecentMessages(messagesQuery);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setGmailProfile(null);
      setMessages([]);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Determine final recipient email
  const getRecipientEmail = (): string => {
    if (recipientPreset === 'coastguard') return 'maritime-safety@coastguard.gov';
    if (recipientPreset === 'ghostnet') return 'response@ghostnetrescue.org';
    if (recipientPreset === 'portcontrol') return 'traffic-control@port-authority.org';
    return customRecipient.trim();
  };

  // Prepare Hazard Alert Email
  const prepareHazardAlert = () => {
    const to = getRecipientEmail();
    if (!to) {
      alert('Please specify a valid recipient email address.');
      return;
    }

    const { subject, bodyText, bodyHtml } = generateHazardAlertEmail(targetToAlert, telemetry);
    
    // Append custom notes if provided
    let finalBodyText = bodyText;
    let finalBodyHtml = bodyHtml;
    if (customNotes.trim()) {
      finalBodyText += `\n\nOPERATIONAL NOTES FROM VESSEL OPERATOR:\n${customNotes.trim()}`;
      finalBodyHtml = finalBodyHtml.replace(
        '</div>\n    <div class="footer">',
        `<div style="margin-top:16px; padding:12px; background:#fef3c7; border:1px solid #fde68a; border-radius:6px; font-size:12px; color:#92400e;">
           <strong>OPERATOR NOTES:</strong><br>${customNotes.trim()}
         </div></div>\n    <div class="footer">`
      );
    }

    // Set pending payload to trigger user confirmation dialog
    setPendingPayload({
      to,
      subject,
      bodyText: finalBodyText,
      bodyHtml: finalBodyHtml,
    });
  };

  // Prepare Custom Email
  const prepareCustomEmail = () => {
    if (!customTo.trim()) {
      alert('Please enter a recipient email.');
      return;
    }
    setPendingPayload({
      to: customTo.trim(),
      subject: customSubject.trim() || 'AQUAGHOST Mission Briefing',
      bodyText: customBody,
    });
  };

  // Execute Send after explicit confirmation
  const confirmAndSend = async () => {
    if (!pendingPayload) return;
    setIsSending(true);
    setSendErrorMessage(null);
    setSendSuccessMessage(null);

    try {
      const response = await sendGmailMessage(pendingPayload);
      setSendSuccessMessage(`Email successfully dispatched via Gmail! (Message ID: ${response.id})`);
      setPendingPayload(null);
      // Reload sent message list
      setTimeout(() => {
        loadRecentMessages(messagesQuery);
      }, 1500);
    } catch (err: any) {
      setSendErrorMessage(err.message || 'Failed to send email. Please check your Gmail connection.');
    } finally {
      setIsSending(false);
    }
  };

  const preview = generateHazardAlertEmail(targetToAlert, telemetry);

  return (
    <div id="gmail-dispatcher-container" className="space-y-4">
      {/* Top Banner & OAuth Connection State */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Gmail Acoustic Alert & Mission Dispatcher
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dispatch automated 3D marine ghost net entanglement alerts and telemetry reports directly from your Gmail account.
              </p>
            </div>
          </div>

          {/* User Sign-In State */}
          <div>
            {isAuthLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Checking Google Auth...</span>
              </div>
            ) : currentUser ? (
              <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-lg border border-slate-800">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || 'User'} 
                    className="w-8 h-8 rounded-full border border-slate-700" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-cyan-900 border border-cyan-700 flex items-center justify-center font-bold text-xs text-cyan-200">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="text-xs">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    {currentUser.displayName || 'Connected User'}
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" title="Active OAuth Token" />
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]">
                    {gmailProfile?.emailAddress || currentUser.email}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign out of Google"
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Official Google Sign In Button */
              <button
                onClick={handleSignIn}
                className="gsi-material-button flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg shadow transition-all cursor-pointer border border-slate-300 active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback alerts */}
        {authError && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
            <button onClick={() => setAuthError(null)} className="text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {sendSuccessMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{sendSuccessMessage}</span>
            </div>
            <button onClick={() => setSendSuccessMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {sendErrorMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{sendErrorMessage}</span>
            </div>
            <button onClick={() => setSendErrorMessage(null)} className="text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Sub-Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('hazard_alert')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'hazard_alert'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Hazard Alert Dispatcher</span>
          </button>
          <button
            onClick={() => setActiveSubTab('custom_email')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'custom_email'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Custom Telemetry Briefing</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('inbox');
              if (currentUser) loadRecentMessages(messagesQuery);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'inbox'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Gmail Communications Log</span>
            {messages.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-cyan-300">
                {messages.length}
              </span>
            )}
          </button>
        </div>

        {currentUser && (
          <div className="text-[11px] font-mono text-slate-400 hidden sm:flex items-center gap-2">
            <span>OAuth: <strong className="text-emerald-400">Gmail Scopes Connected</strong></span>
          </div>
        )}
      </div>

      {/* TAB 1: HAZARD ALERT DISPATCHER */}
      {activeSubTab === 'hazard_alert' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Configuration Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                1. Select Acoustic Anomaly Target
              </h3>

              {/* Target Selector */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Detection</label>
                <select
                  value={targetToAlert.id}
                  onChange={(e) => {
                    const found = targets.find(t => t.id === e.target.value);
                    if (found) {
                      setTargetToAlert(found);
                      onSelectTarget(found);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {targets.map((tgt) => (
                    <option key={tgt.id} value={tgt.id}>
                      {tgt.id}: {tgt.name} [{tgt.status === 'CONFIRMED_HAZARD' ? '🚨 HAZARD' : 'REJECTED'}] (h={tgt.calculatedHeight.toFixed(2)}m)
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Quick Stats */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-bold ${targetToAlert.status === 'CONFIRMED_HAZARD' ? 'text-rose-400' : 'text-slate-400'}`}>
                    {targetToAlert.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">3D Acoustic Height (h):</span>
                  <span className="text-cyan-300 font-bold">{targetToAlert.calculatedHeight.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Shadow Length (L):</span>
                  <span className="text-slate-300">{targetToAlert.shadowLengthL.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinates:</span>
                  <span className="text-slate-300">{targetToAlert.latitude.toFixed(5)}°N, {targetToAlert.longitude.toFixed(5)}°E</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Entanglement Threat:</span>
                  <span className="text-amber-400 font-bold">{targetToAlert.fusedRiskScore}%</span>
                </div>
              </div>

              {/* Recipient Selector */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Dispatch Recipient Agency</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-300 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="recipient"
                      value="coastguard"
                      checked={recipientPreset === 'coastguard'}
                      onChange={() => setRecipientPreset('coastguard')}
                      className="accent-rose-500"
                    />
                    <div>
                      <div className="font-semibold text-white">Coast Guard Maritime Safety</div>
                      <div className="text-[10px] text-slate-400 font-mono">maritime-safety@coastguard.gov</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="recipient"
                      value="ghostnet"
                      checked={recipientPreset === 'ghostnet'}
                      onChange={() => setRecipientPreset('ghostnet')}
                      className="accent-rose-500"
                    />
                    <div>
                      <div className="font-semibold text-white">Ghost Net Recovery Taskforce</div>
                      <div className="text-[10px] text-slate-400 font-mono">response@ghostnetrescue.org</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="recipient"
                      value="portcontrol"
                      checked={recipientPreset === 'portcontrol'}
                      onChange={() => setRecipientPreset('portcontrol')}
                      className="accent-rose-500"
                    />
                    <div>
                      <div className="font-semibold text-white">Port Vessel Traffic Service (VTS)</div>
                      <div className="text-[10px] text-slate-400 font-mono">traffic-control@port-authority.org</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="recipient"
                      value="custom"
                      checked={recipientPreset === 'custom'}
                      onChange={() => setRecipientPreset('custom')}
                      className="accent-rose-500"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Custom Email Address</div>
                      {recipientPreset === 'custom' && (
                        <input
                          type="email"
                          placeholder="e.g. operator@vessel-command.com"
                          value={customRecipient}
                          onChange={(e) => setCustomRecipient(e.target.value)}
                          className="w-full mt-1.5 p-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Operator Notes */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Operator Tactical Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Surface current 1.8 knots south-west; recommend sonar verification before anchoring."
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Dispatch Action */}
              <div className="pt-2">
                {currentUser ? (
                  <button
                    onClick={prepareHazardAlert}
                    className="w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer active:scale-98"
                  >
                    <Send className="w-4 h-4" />
                    <span>Review & Dispatch Hazard Alert via Gmail</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSignIn}
                    className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span>Sign In with Google to Dispatch</span>
                  </button>
                )}
                <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                  Explicit confirmation will be requested before sending email via the Gmail API.
                </p>
              </div>
            </div>
          </div>

          {/* Email Preview Panel */}
          <div className="lg:col-span-7">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col h-full">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Gmail Message Preview
                  </h3>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  To: <span className="text-cyan-300 font-semibold">{getRecipientEmail()}</span>
                </div>
              </div>

              {/* Subject */}
              <div className="bg-slate-950 px-3 py-2 rounded-t-lg border border-slate-800 border-b-0 text-xs font-mono">
                <span className="text-slate-400">Subject: </span>
                <span className="text-white font-bold">{preview.subject}</span>
              </div>

              {/* Email Body Rendering */}
              <div className="bg-white text-slate-900 p-4 rounded-b-lg overflow-y-auto max-h-[460px] border border-slate-800 text-xs selection:bg-rose-200">
                <div dangerouslySetInnerHTML={{ __html: preview.bodyHtml }} />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> HTML + RFC 2822 Multipart Formatted
                </span>
                <span>Includes Direct GPS Google Maps Link</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM TELEMETRY BRIEFING */}
      {activeSubTab === 'custom_email' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg max-w-2xl mx-auto space-y-4">
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
            <Send className="w-4 h-4 text-cyan-400" />
            Compose Custom Mission Briefing
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">To (Recipient Email)</label>
            <input
              type="email"
              placeholder="e.g. scientist@marine-research.edu"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Subject</label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Message Body</label>
            <textarea
              rows={8}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 leading-relaxed"
            />
          </div>

          <div className="pt-2">
            {currentUser ? (
              <button
                onClick={prepareCustomEmail}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>Review & Send Email via Gmail</span>
              </button>
            ) : (
              <button
                onClick={handleSignIn}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>Sign In with Google to Send</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GMAIL COMMUNICATIONS LOG / RECENT MESSAGES */}
      {activeSubTab === 'inbox' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Recent Gmail Messages & Hazard Alerts
              </h3>
            </div>
            {currentUser && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search Gmail (e.g. AQUAGHOST)..."
                  value={messagesQuery}
                  onChange={(e) => setMessagesQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadRecentMessages(messagesQuery);
                  }}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 w-52"
                />
                <button
                  onClick={() => loadRecentMessages(messagesQuery)}
                  disabled={isLoadingMessages}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 border border-slate-700 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            )}
          </div>

          {!currentUser ? (
            <div className="text-center py-12 bg-slate-950/50 rounded-xl border border-slate-800/80 p-6">
              <Mail className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-white mb-1">Connect Your Google Account</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                Sign in to view recent emails, alert delivery status, and sonar communication logs directly from your Gmail inbox.
              </p>
              <button
                onClick={handleSignIn}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-lg shadow inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : isLoadingMessages ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
              <span>Fetching recent communications from Gmail API...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 bg-slate-950/40 rounded-lg text-xs font-mono text-slate-400">
              No recent messages found matching query "{messagesQuery}".
              <div className="mt-2">
                <button
                  onClick={() => {
                    setMessagesQuery('');
                    loadRecentMessages('');
                  }}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  View all recent messages
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white truncate max-w-md flex items-center gap-1.5">
                      {msg.subject?.includes('[AQUAGHOST ALERT]') ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          ALERT
                        </span>
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>{msg.subject || '(No Subject)'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{msg.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>From: <strong className="text-slate-300">{msg.from}</strong></span>
                    {msg.to && <span>&bull; To: <strong className="text-slate-300">{msg.to}</strong></span>}
                  </div>
                  <p className="text-slate-400 text-[11px] line-clamp-1 font-mono">
                    {msg.snippet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MANDATORY USER CONFIRMATION DIALOG FOR WORKSPACE MUTATING/DESTRUCTIVE ACTION (SENDING EMAIL) */}
      {pendingPayload && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Confirm Gmail Email Dispatch
                </h3>
                <p className="text-xs text-slate-400">
                  Please review and authorize sending this message via your Google account.
                </p>
              </div>
            </div>

            {/* Content Summary */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-2">
              <div>
                <span className="text-slate-400">From: </span>
                <span className="text-cyan-300 font-bold">{gmailProfile?.emailAddress || currentUser?.email}</span>
              </div>
              <div>
                <span className="text-slate-400">To: </span>
                <span className="text-white font-bold">{pendingPayload.to}</span>
              </div>
              <div>
                <span className="text-slate-400">Subject: </span>
                <span className="text-amber-300">{pendingPayload.subject}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                This action will send an email from your verified Gmail account. It cannot be recalled once sent.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingPayload(null)}
                disabled={isSending}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSend}
                disabled={isSending}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 shadow-lg shadow-rose-950 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending via Gmail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Viewer Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white truncate max-w-md">
                {selectedMessage.subject}
              </h3>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs font-mono space-y-1 text-slate-300">
              <div><span className="text-slate-400">From:</span> {selectedMessage.from}</div>
              <div><span className="text-slate-400">To:</span> {selectedMessage.to}</div>
              <div><span className="text-slate-400">Date:</span> {selectedMessage.date}</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 max-h-72 overflow-y-auto whitespace-pre-wrap">
              {selectedMessage.snippet}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-xs text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
