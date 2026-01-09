'use client';
import { useEffect } from 'react';

export default function SuccessPage() {
  useEffect(() => {
    // If loaded inside an iframe, tell parent to close modal
    if (window.self !== window.top) {
      window.parent.postMessage('BRIDGE_KYB_COMPLETE', '*');
    } else {
      // If loaded normally, redirect to home
      window.location.href = '/';
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-green-50">
      <h1 className="text-green-700 font-bold text-xl">Verification Complete!</h1>
    </div>
  );
}