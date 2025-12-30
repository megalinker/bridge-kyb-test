import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
  const { protocol, host } = new URL(req.url);
  const baseUrl = `${protocol}//${host}`;

  try {
    const response = await fetch('https://api.bridge.xyz/v0/kyc_links', {
      method: 'POST',
      headers: {
        'Api-Key': BRIDGE_API_KEY || '',
        'Content-Type': 'application/json',
        'Idempotency-Key': uuidv4(),
      },
      body: JSON.stringify({
        type: "business",
        email: `test_user_${Date.now()}@example.com`,
        full_name: "Vercel Test Business",
        redirect_url: baseUrl 
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("Bridge API Error:", JSON.stringify(data));
        throw new Error(JSON.stringify(data));
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}