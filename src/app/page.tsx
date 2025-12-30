'use client';

import { useEffect, useState } from 'react';

type BridgeEvent = {
  id: string;
  type: string;
  payload: any;
  receivedAt: string;
};

export default function Home() {
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [kybUrl, setKybUrl] = useState<string | null>(null);
  const [tosUrl, setTosUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    fullName: ''
  });

  // Derived State: Check if ToS is accepted based on the webhook feed
  const hasAcceptedToS = events.some(evt =>
    evt.payload?.event_object?.has_accepted_terms_of_service === true ||
    evt.payload?.event_object?.tos_status === 'approved'
  );

  useEffect(() => {
    const savedEmail = localStorage.getItem('bridge_active_email');
    if (savedEmail) {
      setActiveEmail(savedEmail);
      setFormData(prev => ({ ...prev, email: savedEmail }));
    }
  }, []);

  useEffect(() => {
    if (!activeEmail) return;

    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/events?email=${encodeURIComponent(activeEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 2000);
    return () => clearInterval(interval);
  }, [activeEmail]);

  const handleCreateKyb = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setKybUrl(null);
    setTosUrl(null);

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
      } else {
        alert("Bridge API Error: " + (data.error || JSON.stringify(data)));
      }
    } catch (e) {
      alert("Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bridge_active_email');
    setActiveEmail(null);
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

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">

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
              <button
                onClick={handleLogout}
                className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-wider bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 transition-all"
              >
                Reset Session
              </button>
            )}
          </div>
        </header>

        {/* SETUP FORM */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4">
            {activeEmail ? "Update or Create New Link" : "1. Start Onboarding Flow"}
          </h2>

          <form onSubmit={handleCreateKyb} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Business Email</label>
              <input
                required
                type="email"
                placeholder="company@example.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
              <input
                required
                type="text"
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-center pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 font-bold shadow-lg shadow-blue-100"
              >
                {loading ? 'Processing...' : 'Generate Onboarding Links'}
              </button>
            </div>
          </form>

          {/* ONBOARDING ACTIONS */}
          {kybUrl && (
            <div className="mt-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black italic">!</span>
                Onboarding Requirements
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1: KYB (Identity) */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Step 1</p>
                      <h4 className="text-white font-bold text-sm">Identity</h4>
                    </div>
                  </div>
                  <a
                    href={kybUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg"
                  >
                    Complete Verification
                  </a>
                </div>

                {/* Step 2: ToS (Legal) - CONDITIONAL HIDE */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3 relative overflow-hidden">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Step 2</p>
                    <h4 className="text-white font-bold text-sm">Terms of Service</h4>
                  </div>

                  {hasAcceptedToS ? (
                    <div className="flex items-center justify-center py-3 bg-green-500/10 border border-green-500/50 text-green-400 rounded-lg font-bold animate-in zoom-in-95">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Accepted
                    </div>
                  ) : (
                    <a
                      href={tosUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-lg font-bold transition-all shadow-lg"
                    >
                      Sign Terms
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* WEBHOOK FEED */}
        <section className="space-y-4 pb-20">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Webhook Feed
              <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
                {events.length}
              </span>
            </h2>
          </div>

          {!activeEmail ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
              <p className="text-sm font-medium">Enter business details to start watching events.</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400">
              <div className="animate-pulse mb-3 text-blue-500 text-2xl">⚡</div>
              <p className="text-sm font-medium text-slate-600">Waiting for events for <b>{activeEmail}</b></p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((evt) => (
                <div key={evt.id} className="bg-white rounded-2xl p-0 shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                        {evt.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                        {evt.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(evt.payload, null, 2), evt.id)}
                        className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
                      >
                        {copiedId === evt.id ? (
                          <span className="text-green-600">✓ Copied</span>
                        ) : (
                          <span>Copy JSON</span>
                        )}
                      </button>
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(evt.receivedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto font-mono leading-relaxed max-h-[400px]">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}