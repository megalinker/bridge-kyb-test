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
  const [loading, setLoading] = useState(false);

  // The email currently being tracked (The "Session")
  const [activeEmail, setActiveEmail] = useState<string | null>(null);

  // Form input state
  const [formData, setFormData] = useState({
    email: '',
    fullName: ''
  });

  // 1. On Mount: Check if there's a saved email in localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem('bridge_active_email');
    if (savedEmail) {
      setActiveEmail(savedEmail);
      setFormData(prev => ({ ...prev, email: savedEmail }));
    }
  }, []);

  // 2. Polling Logic: Fetch events ONLY for the activeEmail
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

    fetchEvents(); // Initial fetch
    const interval = setInterval(fetchEvents, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, [activeEmail]);

  // 3. Create KYB Link Handler
  const handleCreateKyb = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setKybUrl(null);

    try {
      const res = await fetch('/api/create-kyb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.kyc_link) {
        setKybUrl(data.kyc_link);
        setActiveEmail(formData.email);
        localStorage.setItem('bridge_active_email', formData.email);
      } else {
        alert("Error: " + (data.error || JSON.stringify(data)));
      }
    } catch (e) {
      alert("Failed to create KYB Link");
    } finally {
      setLoading(false);
    }
  };

  // 4. Logout / Switch User
  const handleLogout = () => {
    localStorage.removeItem('bridge_active_email');
    setActiveEmail(null);
    setEvents([]);
    setKybUrl(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">

        <header className="flex justify-between items-center border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Bridge Webhook Dashboard</h1>
            {activeEmail && (
              <p className="text-slate-500 text-sm mt-1">
                Watching: <span className="font-semibold text-slate-700">{activeEmail}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {activeEmail && (
              <button
                onClick={handleLogout}
                className="text-xs font-medium text-red-600 hover:text-red-800 underline"
              >
                Switch User
              </button>
            )}
            <div className="hidden md:flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live</span>
            </div>
          </div>
        </header>

        {/* SETUP FORM (Only shows if no email is active or if user wants to generate new link) */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4">
            {activeEmail ? "Generate a new KYB Link" : "Identify Yourself to Begin"}
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
                placeholder="Jane Doe"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-center pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 font-bold shadow-lg shadow-blue-200"
              >
                {loading ? 'Generating...' : 'Start KYB Process'}
              </button>

              {kybUrl && (
                <a
                  href={kybUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full md:w-auto text-center px-6 py-3 bg-green-100 text-green-700 rounded-xl font-bold border border-green-200 hover:bg-green-200 transition-all"
                >
                  Open Form &rarr;
                </a>
              )}
            </div>
          </form>
        </section>

        {/* WEBHOOK LOGS */}
        <section className="space-y-4">
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
              <p className="text-sm font-medium">Enter your email above to see your private webhook events.</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400">
              <div className="animate-pulse mb-2 text-blue-500">●</div>
              <p className="text-sm font-medium">Waiting for your first event for <b>{activeEmail}</b>...</p>
              <p className="text-xs mt-1">Open the KYB link and fill out the details to trigger events.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((evt) => (
                <div key={evt.id} className="bg-white rounded-2xl p-0 shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
                  {/* Event Header */}
                  <div className="flex justify-between items-center px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                        {evt.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">
                        ID: {evt.id}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(evt.receivedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Event Payload */}
                  <div className="p-5">
                    <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto font-mono leading-relaxed max-h-[300px]">
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