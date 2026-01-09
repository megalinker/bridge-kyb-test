'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function KybCallbackPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const inquiryId = searchParams.get('inquiry-id');

    // 1. If we are in a popup (have an opener), send data back and close
    if (window.opener && inquiryId) {
      window.opener.postMessage(
        { type: 'BRIDGE_INQUIRY_RESUME', inquiryId },
        window.location.origin // Security: Only allow our own origin
      );
      window.close();
    } 
    // 2. Fallback: If opened in the same tab (no opener), just redirect home
    else {
      window.location.href = `/?inquiry-id=${inquiryId || ''}`;
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-500 font-medium">Resuming verification...</p>
      </div>
    </div>
  );
}