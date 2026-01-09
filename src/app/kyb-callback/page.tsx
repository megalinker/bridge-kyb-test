'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CallbackContent() {
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState('Finalizing verification...');

  useEffect(() => {
    // 1. Extract ID if present (optional, but good for resuming)
    const id = searchParams.get('inquiry-id') || 
               searchParams.get('inquiry_id') || 
               searchParams.get('reference_id');

    const timestamp = Date.now();

    // 2. Define the signal payload
    // If we have an ID, we send RESUME. If not, we send REFRESH_ONLY (which triggers the status check on Tab 1)
    const payload = {
      type: id ? 'BRIDGE_INQUIRY_RESUME' : 'BRIDGE_REFRESH_ONLY',
      inquiryId: id,
      timestamp
    };

    // 3. BROADCAST: LocalStorage (Cross-tab communication)
    try {
      localStorage.setItem('bridge-handshake-signal', JSON.stringify(payload));
    } catch (e) { console.error(e); }

    // 4. DIRECT: PostMessage (If opened via popup)
    if (window.opener) {
      window.opener.postMessage(payload, '*');
    }

    // 5. AUTO-CLOSE
    setMsg('Verification Complete. Closing tab...');
    
    // We try to close immediately. 
    // Note: Browsers may block this if the tab wasn't opened by a script.
    // If blocked, the user sees the message below.
    window.close();
    const timer = setTimeout(() => {
        window.close(); // Try again after a split second
    }, 500);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 text-slate-800 p-4 text-center">
      <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mb-4 text-3xl shadow-lg">✓</div>
      <h1 className="text-xl font-bold mb-2">Success</h1>
      <p className="text-slate-600 mb-6">{msg}</p>
      <button 
        onClick={() => window.close()}
        className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700"
      >
        Close Window
      </button>
    </div>
  );
}

export default function KybCallbackPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Processing...</div>}>
      <CallbackContent />
    </Suspense>
  );
}