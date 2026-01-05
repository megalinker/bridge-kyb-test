'use client';

import { useEffect, useState, useCallback } from 'react';

// --- Types based on your actual Bridge API Response ---
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

// --- Helper: format snake_case to Title Case ---
const formatLabel = (str: string) => {
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// --- Helper: Recursively extract missing fields from Bridge's complex logic tree ---
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
    // For UI simplicity, we tag these as "One of: ..."
    const options = logic.any_of.flatMap(extractMissingFields);
    if (options.length > 0) {
      fields.push(`One of: [${options.join(' / ')}]`);
    }
  }

  return fields;
};

export default function Home() {
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [kybUrl, setKybUrl] = useState<string | null>(null);
  const [tosUrl, setTosUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ email: '', fullName: '' });

  // 1. Load Session
  useEffect(() => {
    const savedEmail = localStorage.getItem('bridge_active_email');
    const savedCustomerId = localStorage.getItem('bridge_active_customer_id');
    if (savedEmail) {
      setActiveEmail(savedEmail);
      setFormData(prev => ({ ...prev, email: savedEmail }));
    }
    if (savedCustomerId) setCustomerId(savedCustomerId);
  }, []);

  // 2. Poll Webhooks
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

  // 3. Fetch Customer Status
  const fetchCustomerStatus = useCallback(async () => {
    if (!customerId) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/customer?id=${customerId}`);
      if (res.ok) setCustomerData(await res.json());
    } catch (err) { console.error(err); } 
    finally { setIsRefreshing(false); }
  }, [customerId]);

  useEffect(() => {
    fetchCustomerStatus();
    const interval = setInterval(fetchCustomerStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchCustomerStatus]);

  const handleCreateKyb = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setKybUrl(null);
    setTosUrl(null);
    setCustomerData(null);

    try {
      const res = await fetch('/api/create-kyb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.kyc_link) {
        setKybUrl(data.kyc_link);
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

  const handleLogout = () => {
    localStorage.removeItem('bridge_active_email');
    localStorage.removeItem('bridge_active_customer_id');
    setActiveEmail(null);
    setCustomerId(null);
    setCustomerData(null);
    setEvents([]);
    setKybUrl(null);
    setTosUrl(null);
    setFormData({ email: '', fullName: '' });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Determine the display color for status badges
  const getStatusColor = (status?: string) => {
    switch(status) {
      case 'active': return 'bg-green-500 text-white';
      case 'approved': return 'bg-green-500 text-white';
      case 'rejected': return 'bg-red-500 text-white';
      case 'manual_review': return 'bg-orange-500 text-white';
      case 'incomplete': return 'bg-yellow-500 text-black';
      case 'not_started': return 'bg-slate-600 text-white';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

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

        {/* --- DETAILED CUSTOMER DASHBOARD --- */}
        {customerId && (
            <section className="bg-slate-900 rounded-2xl shadow-xl border border-slate-700 text-slate-300 overflow-hidden">
                
                {/* Dashboard Header */}
                <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/50">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-white font-bold text-xl">Customer Status</h2>
                            <button 
                                onClick={fetchCustomerStatus}
                                disabled={isRefreshing}
                                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-[10px] font-bold uppercase px-2 py-1 rounded transition-all active:scale-95 disabled:opacity-50"
                            >
                                <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
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
                        {/* Overall Status */}
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Status</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${getStatusColor(customerData?.status)}`}>
                                {customerData?.status ? formatLabel(customerData.status) : 'LOADING...'}
                            </span>
                        </div>
                        {/* TOS Status */}
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Terms</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${customerData?.has_accepted_terms_of_service ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                {customerData?.has_accepted_terms_of_service ? 'ACCEPTED' : 'PENDING'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-700">
                    
                    {/* COL 1: Endorsements & Missing Data */}
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

                                      {/* Show Missing Requirements */}
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
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            All requirements met
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

                    {/* COL 2: Capabilities & Details */}
                    <div className="p-6 space-y-6 bg-slate-800/20">
                        
                        {/* Capabilities */}
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

                        {/* Rejection Reasons (if any) */}
                        {customerData?.rejection_reasons && customerData.rejection_reasons.length > 0 && (
                            <div className="pt-6 border-t border-slate-700">
                                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">Rejection Reasons</h3>
                                <ul className="list-disc pl-4 space-y-1">
                                    {customerData.rejection_reasons.map((r, i) => (
                                        <li key={i} className="text-xs text-red-300">{r.reason}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        {/* Timestamps */}
                        <div className="pt-6 border-t border-slate-700 text-[10px] text-slate-600 font-mono space-y-1">
                            <p>Last Sync: {new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>
                </div>
            </section>
        )}

        {/* --- FORM SECTION --- */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">
            {activeEmail ? "Update or Create New Link" : "1. Start Onboarding Flow"}
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
                {loading ? 'Processing...' : 'Generate Onboarding Links'}
              </button>
            </div>
          </form>

          {/* ONBOARDING LINKS */}
          {kybUrl && (
            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-3">1. Identity Verification</h4>
                  <a href={kybUrl} target="_blank" rel="noreferrer" className="block text-center w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all">
                    Open KYB Link
                  </a>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-3">2. Terms of Service</h4>
                  {customerData?.has_accepted_terms_of_service ? (
                     <div className="py-2.5 text-center bg-green-50 text-green-600 border border-green-200 rounded-lg font-bold text-sm">
                        ✓ Accepted
                     </div>
                  ) : (
                    <a href={tosUrl || '#'} target="_blank" rel="noreferrer" className="block text-center w-full py-2.5 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg font-bold text-sm transition-all">
                        Sign Terms
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* --- WEBHOOK LOGS --- */}
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