'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [status, setStatus] = useState('Checking URL parameters...');

  const addLog = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0,8)}: ${msg}`]);

  useEffect(() => {
    // 1. DUMP ALL PARAMS TO SCREEN FOR DEBUGGING
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    addLog(`Received Params: ${JSON.stringify(params)}`);

    // 2. CHECK FOR ANY VARIATION OF ID
    const id = searchParams.get('inquiry-id') || 
               searchParams.get('inquiry_id') || 
               searchParams.get('inquiryId') || 
               searchParams.get('reference_id');

    if (!id) {
      setStatus("⚠️ No Inquiry ID found.");
      addLog("Critical: Bridge redirected here but didn't attach an ID.");
      addLog("Possible causes: Flow completed fully? API redirect_url conflict?");
      
      // Fallback: If no ID, we assume the user might be DONE. 
      // We send a generic 'REFRESH' signal instead of a 'RESUME' signal.
      sendSignal(null, 'BRIDGE_REFRESH_ONLY');
      return;
    }

    setStatus("✅ ID Found. Broadcasting...");
    addLog(`ID found: ${id}`);
    sendSignal(id, 'BRIDGE_INQUIRY_RESUME');

  }, [searchParams]);

  const sendSignal = (id: string | null, type: string) => {
    const payload = JSON.stringify({
      inquiryId: id,
      type: type, // New field to tell parent what to do
      timestamp: Date.now()
    });

    try {
      localStorage.setItem('bridge-handshake-signal', payload);
      addLog("Wrote to LocalStorage.");
    } catch (e) {
      addLog(`Storage Error: ${e}`);
    }

    if (window.opener) {
      addLog("Found opener. Posting message...");
      window.opener.postMessage({ type, inquiryId: id }, '*');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-6 font-mono text-sm">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-white mb-2 border-b border-slate-700 pb-2">Debug Callback</h1>
        
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <p className="text-yellow-400 font-bold mb-2">STATUS: {status}</p>
          <div className="space-y-1">
            {debugLog.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>

        <div className="flex gap-4">
            <button onClick={() => window.close()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold">
                Close Tab
            </button>
            <button onClick={() => router.push('/')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold">
                Go to Home (Manual)
            </button>
        </div>
      </div>
    </div>
  );
}

export default function KybCallbackPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}