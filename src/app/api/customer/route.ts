import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('id');
  const apiKey = process.env.BRIDGE_API_KEY;

  if (!customerId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const response = await fetch(`https://api.sandbox.bridge.xyz/v0/customers/${customerId}`, {
      headers: {
        'Api-Key': apiKey || '',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
