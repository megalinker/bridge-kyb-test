'use client';

import { useEffect, useState } from 'react';

// Define the shape based on our Prisma model
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

  // Poll for new events every 2 seconds
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    fetchEvents(); // Initial fetch
    const interval = setInterval(fetchEvents, 2000); // Poll
    return () => clearInterval(interval);
  }, []);

  const handleCreateKyb = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-kyb', { method: 'POST' });
      const data = await res.json();
      if (data.url) setKybUrl(data.url);
      else alert("Error: " + JSON.stringify(data));
    } catch (e) {
      alert("Failed to create KYB Link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header className="flex justify-between items-center border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold text-slate-900">Bridge KYB + Vercel</h1>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">Live Sync (DB)</span>
          </div>
        </header>

        {/* Action Panel */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold mb-4">Step 1: Start KYB</h2>
          <div className="flex gap-4 items-center">
            <button
              onClick={handleCreateKyb}
              disabled={loading}
              className="bg-black text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 font-medium"
            >
              {loading ? 'Creating...' : 'Generate KYB Link'}
            </button>
            {kybUrl && (
               <a 
                 href={kybUrl} 
                 target="_blank" 
                 rel="noreferrer"
                 className="text-blue-600 hover:text-blue-800 underline font-medium"
               >
                 Open KYB Form &rarr;
               </a>
            )}
          </div>
        </section>

        {/* Webhook Log */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Step 2: Webhook Log</h2>
          {events.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
              No webhooks received yet. <br/> Trigger a KYB event or use /send to test.
            </div>
          ) : (
            <div className="grid gap-4">
              {events.map((evt) => (
                <div key={evt.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 transition-all hover:shadow-md">
                  <div className="flex justify-between items-center mb-3">
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide uppercase">
                      {evt.type}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(evt.receivedAt).toLocaleString()}
                    </span>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}