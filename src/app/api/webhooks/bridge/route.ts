import { NextRequest, NextResponse } from 'next/server';
import { verifyBridgeSignature } from '@/lib/verify';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('X-Webhook-Signature');

        // 1. Verify Signature
        const isValid = verifyBridgeSignature(
            rawBody,
            signature,
            process.env.BRIDGE_WEBHOOK_PUBLIC_KEY_PEM
        );

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // 2. Parse and Store
        const event = JSON.parse(rawBody);

        await prisma.bridgeEvent.upsert({
            where: { id: event.id },
            update: {},
            create: {
                id: event.id,
                type: event.type,
                payload: event,
            },
        });

        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}