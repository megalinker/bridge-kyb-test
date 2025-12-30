import { NextRequest, NextResponse } from 'next/server';
import { verifyBridgeSignature } from '@/lib/verify';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('X-Webhook-Signature');

    const isValid = verifyBridgeSignature(
      rawBody,
      signature,
      process.env.BRIDGE_WEBHOOK_PUBLIC_KEY_PEM
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // FIX: Bridge uses 'event_id' and 'event_type'
    const eventId = event.event_id;
    const eventType = event.event_type;

    if (!eventId) {
      console.error("Missing event_id in payload");
      return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
    }

    await prisma.bridgeEvent.upsert({
      where: { id: eventId },
      update: {},
      create: {
        id: eventId,
        type: eventType || 'unknown',
        payload: event, 
      },
    });

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}