import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Always fetch fresh data

export async function GET() {
  try {
    const events = await prisma.bridgeEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 50, // Limit to last 50 events
    });
    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}