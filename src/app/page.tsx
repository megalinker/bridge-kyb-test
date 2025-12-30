'use client';

import { useEffect, useState } from 'react';

// Define the shape of our stored events
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
  
  // The email currently being tracked (The "Private Session")
  const [activeEmail, setActiveEmail] = useState<string | null>(null);

  // Form input state
  const [formData, setFormData] = useState({
    email: '',
    fullName: ''
  });

  // 1. On Mount: Check if there's a saved email in localStorage to resume the session
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
    const interval = setInterval(fetchEvents, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [activeEmail]);

  // 3. Create KYB & ToS Link Handler
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
      
      // Bridge returns 'kyc_link' and 'tos_link'
      if (data.kyc_link) {
        setKybUrl(data.kyc_link);
        setTosUrl(data.tos_link);
        
        // Lock this email as the active session
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

  // 4. Logout / Switch User Logic
  const handleLogout = () => {
    localStorage.removeItem('bridge_active_email');
    setActiveEmail(null);
    setEvents([]);
    setKybUrl(null);
    setTosUrl(null);
    setFormData({ email: '', fullName: '' });
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation / Header */}
        <header className="flex justify-between items-center border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Bridge Bridge Onboarding</h1>
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
            <div className="hidden md:flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Watcher</span>
            </div>
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
                onChange={(e) => setFormData({...formData, email: e.target.value})}
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
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
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

          {/* ONBOARDING ACTIONS (Only visible after generating) */}
          {kybUrl && (
            <div className="mt-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black italic">!</span>
                Two Steps Required
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* KYB Action */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Step 1</p>
                    <h4 className="text-white font-bold text-sm">Business Verification</h4>
                  </div>
                  <a 
                    href={kybUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block text-center w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg"
                  >
                    Complete Identity
                  </a>
                </div>

                {/* ToS Action */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Step 2</p>
                    <h4 className="text-white font-bold text-sm">Terms of Service</h4>
                  </div>
                  <a 
                    href={tosUrl || '#'} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block text-center w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-lg font-bold transition-all shadow-lg"
                  >
                    Accept ToS
                  </a>
                </div>
              </div>
              
              <p className="text-slate-500 text-[10px] mt-4 text-center font-medium italic">
                Status will update in the feed below as you complete each step.
              </p>
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
              <p className="text-xs mt-1">Events usually arrive within seconds of link generation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((evt) => (
                <div key={evt.id} className="bg-white rounded-2xl p-0 shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
                  {/* Event Meta Header */}
                  <div className="flex justify-between items-center px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                        {evt.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                        {evt.id}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(evt.receivedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {/* JSON Payload Display */}
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