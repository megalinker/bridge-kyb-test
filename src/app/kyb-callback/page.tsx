'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('Initializing...');
  const [inquiryId, setInquiryId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get('inquiry-id');
    console.log("[Callback] Page loaded. Found Inquiry ID:", id);

    if (!id) {
      setStatus("Error: No Inquiry ID found in URL.");
      return;
    }

    setInquiryId(id);
    setStatus("Broadcasting signal to main tab...");

    // 1. Write to LocalStorage (This is the signal)
    const payload = JSON.stringify({
      inquiryId: id,
      timestamp: Date.now()
    });

    try {
      localStorage.setItem('bridge-handshake-signal', payload);
      console.log("[Callback] Wrote to LocalStorage:", payload);
      setStatus("Signal sent. Waiting for main tab...");
    } catch (e) {
      console.error("[Callback] Storage Error:", e);
      setStatus("Error writing to storage.");
    }

    // 2. Attempt PostMessage (Backup for direct popups)
    if (window.opener) {
      console.log("[Callback] Found window.opener. Posting message...");
      window.opener.postMessage({ type: 'BRIDGE_INQUIRY_RESUME', inquiryId: id }, '*');
    }

    // 3. Auto-close timer (Optional - currently disabled to let you debug)
    // You can uncomment this later if it works perfectly
    /*
    setTimeout(() => {
       window.close();
    }, 3000);
    */

  }, [searchParams]);

  const handleContinueHere = () => {
    if (inquiryId) {
      console.log("[Callback] User chose to continue in this tab.");
      // Redirect to the main app, carrying the ID
      router.push(`/?inquiry-id=${inquiryId}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Resume Verification</h1>

        <div className="bg-slate-100 p-3 rounded font-mono text-xs text-left mb-4 overflow-x-auto text-slate-600 border border-slate-200">
          <div className="font-bold text-slate-400 mb-1">DEBUG LOG:</div>
          {status}
          <br />
          ID: {inquiryId || 'None'}
        </div>

        <p className="text-slate-600 mb-6 text-sm">
          We sent a signal to your original tab to refresh the frame.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.close()}
            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors"
          >
            Close this Tab (Try first)
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <button
            onClick={handleContinueHere}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-200"
          >
            Continue in this Window ➔
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KybCallbackPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}