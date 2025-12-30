import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) return NextResponse.json([]);

  try {
    const events = await prisma.bridgeEvent.findMany({
      where: {
        OR: [
          // Bridge KYB Link objects: payload.event_object.email
          { payload: { path: ['event_object', 'email'], equals: email } },
          // Bridge Customer objects: payload.event_object.email
          { payload: { path: ['event_object', 'email_address'], equals: email } },
          // Backup for other event structures
          { payload: { path: ['email'], equals: email } }
        ]
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}