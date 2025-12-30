import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    // If no email is provided, return empty or a 401
    return NextResponse.json([]);
  }

  try {
    const events = await prisma.bridgeEvent.findMany({
      where: {
        // This filters the JSON "payload" column. 
        // Bridge events like kyc_link.created have email at payload.email
        // Other events have it at payload.customer.email
        OR: [
          { payload: { path: ['email'], equals: email } },
          { payload: { path: ['customer', 'email'], equals: email } },
          { payload: { path: ['event_object', 'email'], equals: email } }
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