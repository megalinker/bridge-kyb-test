'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const inquiryId = searchParams.get('inquiry-id');
    if (!inquiryId) return;

    // --- STRATEGY 1: Standard Opener Handshake (Try this first) ---
    if (window.opener) {
      console.log("Found opener, sending postMessage...");
      window.opener.postMessage(
        { type: 'BRIDGE_INQUIRY_RESUME', inquiryId },
        window.location.origin
      );
    }

    // --- STRATEGY 2: LocalStorage Broadcast (The Robust Fix) ---
    // This triggers a 'storage' event in the OTHER tab (Tab 1)
    console.log("Broadcasting via LocalStorage...");
    localStorage.setItem('bridge-handshake-signal', JSON.stringify({
      inquiryId,
      timestamp: Date.now()
    }));

    // --- ACTION: Close this tab ---
    // Give the broadcast a split second to propagate, then close
    setTimeout(() => {
      window.close();
      
      // If browser blocks window.close() (because script didn't open it),
      // we show a message asking user to close it.
    }, 500);

  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 text-2xl">
        ✓
      </div>
      <h1 className="text-xl font-bold text-slate-800">Verification Signal Sent</h1>
      <p className="text-slate-600 mt-2 text-center max-w-md">
        We have updated your main session.
      </p>
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <strong>Please close this tab</strong> and return to the previous window to continue.
      </div>
      
      <button 
        onClick={() => window.close()}
        className="mt-6 px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700"
      >
        Close Tab
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