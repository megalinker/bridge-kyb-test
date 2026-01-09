'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

type RequirementLogic = string | { all_of?: RequirementLogic[] } | { any_of?: RequirementLogic[] };

type BridgeEndorsement = {
  name: string;
  status: string;
  requirements?: {
    complete: string[];
    missing?: RequirementLogic;
  };
};

type CustomerData = {
  id: string;
  status: string;
  has_accepted_terms_of_service: boolean;
  endorsements?: BridgeEndorsement[];
  rejection_reasons?: { reason: string }[];
  capabilities?: {
    payin_crypto: string;
    payout_crypto: string;
    payin_fiat: string;
    payout_fiat: string;
  };
};

type BridgeEvent = {
  id: string;
  type: string;
  payload: any;
  receivedAt: string;
};

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

const formatLabel = (str: string) => {
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const extractMissingFields = (logic: RequirementLogic | undefined): string[] => {
  if (!logic) return [];
  if (typeof logic === 'string') return [logic];

  let fields: string[] = [];

  if ('all_of' in logic && Array.isArray(logic.all_of)) {
    logic.all_of.forEach(item => {
      fields = [...fields, ...extractMissingFields(item)];
    });
  }

  if ('any_of' in logic && Array.isArray(logic.any_of)) {
    const options = logic.any_of.flatMap(extractMissingFields);
    if (options.length > 0) {
      fields.push(`One of: [${options.join(' / ')}]`);
    }
  }

  return fields;
};

// -----------------------------------------------------------------------------
// MAIN CONTENT COMPONENT
// -----------------------------------------------------------------------------

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // --- STATE ---
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [kybUrl, setKybUrl] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [tosUrl, setTosUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Controls the "Please continue in new tab" overlay
  const [isSyncing, setIsSyncing] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', fullName: '' });

  // --- REFS FOR FOCUS TRACKING ---
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const isHoveringIframe = useRef(false);

  // ---------------------------------------------------------------------------
  // DEBUG: IFRAME MESSAGE SPY
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Ignore messages from our own app (like the handshake signal)
      if (event.origin === window.location.origin) return;

      // 2. Ignore generic React/Extension noise
      if (typeof event.data === 'object' && event.data?.source?.includes('react')) return;

      // 3. Log everything else (Likely Persona/Bridge)
      console.log("_____________________________");
      console.log("📩 IFRAME MESSAGE RECEIVED");
      console.log("Origin:", event.origin);
      console.log("Data:", event.data);
      console.log("_____________________________");
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ---------------------------------------------------------------------------
  // 2. DATA FETCHING (Status & Webhooks)
  // ---------------------------------------------------------------------------
  const fetchCustomerStatus = useCallback(async () => {
    if (!customerId) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/customer?id=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerData(data);
      }
    } catch (err) { console.error(err); }
    finally { setIsRefreshing(false); }
  }, [customerId]);

  // Poll for status updates (every 5s)
  useEffect(() => {
    fetchCustomerStatus();
    const interval = setInterval(fetchCustomerStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchCustomerStatus]);

  // Poll for webhooks (every 3s)
  useEffect(() => {
    if (!activeEmail) return;
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/events?email=${encodeURIComponent(activeEmail)}`);
        if (res.ok) setEvents(await res.json());
      } catch (err) { console.error(err); }
    };
    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, [activeEmail]);

  // ---------------------------------------------------------------------------
  // 3. CORE LOGIC: REACT TO STATUS CHANGE (Terminal States Only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!customerData) return;

    // We only auto-close the iframe if the status is TERMINAL.
    // 'awaiting_ubo' is NOT terminal, so we keep the iframe open for that.
    const isTerminalState =
      customerData.status === 'manual_review' ||
      customerData.status === 'active' ||
      customerData.status === 'rejected';

    if (iframeUrl && isTerminalState) {
      console.log(`[Main] Status transitioned to terminal state '${customerData.status}'. Closing Iframe.`);
      setIframeUrl(null);
      setIsSyncing(false);
    }
  }, [customerData, iframeUrl]);


  // ---------------------------------------------------------------------------
  // 4. CORE LOGIC: HANDSHAKE (Signal from Tab 2)
  // ---------------------------------------------------------------------------
  const generateWidgetUrl = useCallback((originalUrl: string | null, inquiryId?: string) => {
    if (!originalUrl && !inquiryId) return null;
    try {
      const baseUrl = 'https://bridge.withpersona.com/widget';
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const callbackUrl = `${currentOrigin}/kyb-callback`;

      if (inquiryId) {
        // RESUME MODE
        const params = new URLSearchParams();
        params.set('inquiry-id', inquiryId);
        params.set('iframe-origin', currentOrigin);
        params.set('redirect-uri', callbackUrl);
        return `${baseUrl}?${params.toString()}`;
      } else if (originalUrl) {
        // NEW SESSION MODE
        const urlObj = new URL(originalUrl);
        const pathname = urlObj.pathname.replace(/\/verify(\/)?/, '/widget$1');
        urlObj.pathname = pathname;
        urlObj.searchParams.set('iframe-origin', currentOrigin);
        urlObj.searchParams.set('redirect-uri', callbackUrl);
        return urlObj.toString();
      }
      return '';
    } catch (e) {
      return originalUrl;
    }
  }, []);

  useEffect(() => {
    // Poll LocalStorage for signals from the other tab
    const checkStorage = () => {
      const raw = localStorage.getItem('bridge-handshake-signal');
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (Date.now() - data.timestamp < 30000) {
            console.log("[Main] Received Signal from Tab 2:", data.type);

            // Case 1: Tab 2 finished and gave us an ID to resume
            if (data.type === 'BRIDGE_INQUIRY_RESUME' && data.inquiryId) {
              const resumeUrl = generateWidgetUrl(null, data.inquiryId);
              setIframeUrl(resumeUrl);

              // Keep overlay for 1.5s to allow iframe to load, then reveal
              setTimeout(() => setIsSyncing(false), 1500);
            }
            // Case 2: Tab 2 just said "I'm done, refresh data"
            else {
              setIsSyncing(false);
            }

            fetchCustomerStatus();
            localStorage.removeItem('bridge-handshake-signal');
          }
        } catch (e) { console.error(e); }
      }
    };

    // Check frequently
    const interval = setInterval(checkStorage, 500);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bridge-handshake-signal') checkStorage();
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [generateWidgetUrl, fetchCustomerStatus]);


  // ---------------------------------------------------------------------------
  // 5. SESSION & HANDLERS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const savedEmail = localStorage.getItem('bridge_active_email');
    const savedCustomerId = localStorage.getItem('bridge_active_customer_id');
    if (savedEmail) {
      setActiveEmail(savedEmail);
      setFormData(prev => ({ ...prev, email: savedEmail }));
    }
    if (savedCustomerId) setCustomerId(savedCustomerId);
  }, []);

  const handleCreateKyb = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setKybUrl(null);
    setIframeUrl(null);
    setTosUrl(null);
    setCustomerData(null);
    setIsSyncing(false);

    try {
      const res = await fetch('/api/create-kyb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.kyc_link) {
        setKybUrl(data.kyc_link); // Triggers the iframe generation via useEffect below
        setTosUrl(data.tos_link);
        setActiveEmail(formData.email);
        localStorage.setItem('bridge_active_email', formData.email);
        if (data.customer_id) {
          setCustomerId(data.customer_id);
          localStorage.setItem('bridge_active_customer_id', data.customer_id);
        }
      } else {
        alert("Bridge Error: " + (data.error || JSON.stringify(data)));
      }
    } catch (e) { alert("Network Error"); }
    finally { setLoading(false); }
  };

  // When kybUrl is set by the API, generate the Iframe URL
  useEffect(() => {
    if (kybUrl) {
      setIframeUrl(generateWidgetUrl(kybUrl));
    }
  }, [kybUrl, generateWidgetUrl]);

  const handleLogout = () => {
    localStorage.clear();
    setActiveEmail(null);
    setCustomerId(null);
    setCustomerData(null);
    setEvents([]);
    setKybUrl(null);
    setIframeUrl(null);
    setTosUrl(null);
    setIsSyncing(false);
    setFormData({ email: '', fullName: '' });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white';
      case 'approved': return 'bg-green-500 text-white';
      case 'rejected': return 'bg-red-500 text-white';
      case 'manual_review': return 'bg-orange-500 text-white';
      case 'incomplete': return 'bg-yellow-500 text-black';
      case 'not_started': return 'bg-slate-600 text-white';
      case 'awaiting_ubo': return 'bg-purple-500 text-white';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  // ---------------------------------------------------------------------------
  // 6. RENDER
  // ---------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Bridge Onboarding</h1>
            {activeEmail && (
              <p className="text-slate-500 text-sm mt-1">
                Session: <span className="font-semibold text-slate-700">{activeEmail}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {activeEmail && (
              <button onClick={handleLogout} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 uppercase">
                Reset
              </button>
            )}
          </div>
        </header>

        {/* CUSTOMER DASHBOARD */}
        {customerId && (
          <section className="bg-slate-900 rounded-2xl shadow-xl border border-slate-700 text-slate-300 overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/50">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-white font-bold text-xl">Customer Status</h2>
                  <button
                    onClick={fetchCustomerStatus}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-[10px] font-bold uppercase px-2 py-1 rounded transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isRefreshing ? 'Syncing...' : 'Sync'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                  ID: {customerId}
                  <button onClick={() => copyToClipboard(customerId, 'cid')} className="hover:text-white">
                    {copiedId === 'cid' ? '✓' : '📋'}
                  </button>
                </p>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Current State</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${getStatusColor(customerData?.status)}`}>
                    {customerData?.status ? formatLabel(customerData.status) : 'LOADING...'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-700">
              {/* Endorsements Column */}
              <div className="p-6 md:col-span-2 space-y-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Endorsements & Requirements
                </h3>

                {customerData?.endorsements?.length ? (
                  <div className="space-y-4">
                    {customerData.endorsements.map((end, idx) => {
                      const missing = extractMissingFields(end.requirements?.missing);
                      const isComplete = end.status === 'approved' || end.status === 'active';

                      return (
                        <div key={idx} className={`rounded-xl border ${isComplete ? 'border-green-900/50 bg-green-900/10' : 'border-slate-700 bg-slate-800/50'} p-4`}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-white capitalize">{formatLabel(end.name)} Check</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getStatusColor(end.status)}`}>
                              {formatLabel(end.status)}
                            </span>
                          </div>
                          {!isComplete && missing.length > 0 ? (
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                              <p className="text-[10px] font-bold text-orange-400 uppercase mb-2">Missing Information:</p>
                              <ul className="space-y-1">
                                {missing.map((field, i) => (
                                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                    <span className="text-orange-500 mt-0.5">⚠</span>
                                    <span>{formatLabel(field)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : isComplete ? (
                            <div className="text-xs text-green-400 flex items-center gap-1">
                              ✓ All requirements met
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">Processing...</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No endorsements found.</p>
                )}
              </div>

              {/* Capabilities Column */}
              <div className="p-6 space-y-6 bg-slate-800/20">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Capabilities
                  </h3>
                  <div className="space-y-3">
                    {customerData?.capabilities ? (
                      Object.entries(customerData.capabilities).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{formatLabel(key)}</span>
                          <span className={`font-mono font-bold uppercase ${val === 'active' ? 'text-green-400' : 'text-yellow-500'}`}>
                            {val}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">No capabilities data yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FORM & IFRAME SECTION */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">
            {activeEmail ? "Verification Session" : "Start Onboarding Flow"}
          </h2>

          <form onSubmit={handleCreateKyb} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Business Email</label>
              <input required type="email" placeholder="company@example.com" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
              <input required type="text" placeholder="John Doe" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
            </div>
            <div className="md:col-span-2 pt-2">
              <button type="submit" disabled={loading} className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 font-bold disabled:opacity-50 transition-all">
                {loading ? 'Processing...' : 'Generate / Refresh Link'}
              </button>
            </div>
          </form>

          {/* DYNAMIC CONTENT AREA */}
          {iframeUrl ? (
            // --- STATE 1: IFRAME ACTIVE ---
            <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  {iframeUrl.includes('inquiry-id') ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Resuming Verification...
                    </>
                  ) : 'Identity Verification'}
                </h3>
                <div className="flex gap-2">
                  {tosUrl && !customerData?.has_accepted_terms_of_service && (
                    <a href={tosUrl} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-700">
                      Open TOS ↗
                    </a>
                  )}
                  <a href={iframeUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center">
                    Open in new tab (Fallback) ↗
                  </a>
                </div>
              </div>

              {/* IFRAME CONTAINER WITH MOUSE TRACKING */}
              <div
                ref={iframeContainerRef}
                className="w-full rounded-2xl border border-slate-200 overflow-hidden shadow-md bg-slate-50 relative h-[750px]"
                onMouseEnter={() => { isHoveringIframe.current = true; }}
                onMouseLeave={() => { isHoveringIframe.current = false; }}
              >
                <iframe
                  key={iframeUrl}
                  src={iframeUrl}
                  className="w-full h-full border-none bg-white"
                  title="Bridge KYB Verification"
                  allow="camera; microphone; geolocation; encrypted-media; fullscreen"
                />

                {/* --- SYNC OVERLAY --- */}
                {/* This covers the iframe when user is active in another tab */}
                {isSyncing && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <h3 className="text-lg font-bold text-slate-800">Continuing in New Tab...</h3>
                    <p className="text-slate-500 max-w-sm mt-2">
                      We detected the verification flow opened in a new window. Please complete it there.
                    </p>
                    <button
                      onClick={() => setIsSyncing(false)}
                      className="mt-6 text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      I didn't open a new tab (Close Overlay)
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // --- STATE 2: TERMINAL STATUSES ---
            (customerData?.status === 'manual_review' || customerData?.status === 'active' || customerData?.status === 'rejected') && (
              <div className="mt-8 p-10 bg-green-50 border border-green-100 rounded-2xl text-center animate-in slide-in-from-bottom-5 duration-500">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                <h3 className="text-xl font-bold text-green-800">Verification Submitted</h3>
                <p className="text-green-700 mt-2 max-w-lg mx-auto">
                  The process has reached a terminal state.
                  <br />
                  <span className="font-bold uppercase mt-2 block">{formatLabel(customerData.status)}</span>
                </p>
              </div>
            )
          )}
        </section>

        {/* WEBHOOK LOGS */}
        <section className="space-y-4 pb-20">
          <h2 className="text-lg font-bold flex items-center gap-2">Webhook Feed <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{events.length}</span></h2>
          <div className="space-y-4">
            {events.length === 0 && <div className="text-center py-10 bg-white border border-dashed border-slate-300 rounded-xl text-slate-400 text-sm">No webhooks received yet.</div>}
            {events.map((evt) => (
              <div key={evt.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{evt.type}</span>
                  <span className="text-[10px] text-slate-400">{new Date(evt.receivedAt).toLocaleTimeString()}</span>
                </div>
                <pre className="p-4 text-[10px] text-slate-600 bg-white overflow-x-auto font-mono">
                  {JSON.stringify(evt.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

// --- EXPORT DEFAULT (Wrapped for Suspense) ---
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-10 flex items-center justify-center">Loading Application...</div>}>
      <HomeContent />
    </Suspense>
  );
}