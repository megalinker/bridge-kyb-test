import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
    const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
    const { protocol, host } = new URL(req.url);
    const baseUrl = `${protocol}//${host}`;

    try {
        // 1. Read user input from the Frontend
        const body = await req.json();
        const { email, fullName } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 2. Call Bridge API with the user's data
        const response = await fetch('https://api.sandbox.bridge.xyz/v0/kyc_links', {
            method: 'POST',
            headers: {
                'Api-Key': BRIDGE_API_KEY || '',
                'Content-Type': 'application/json',
                'Idempotency-Key': uuidv4(),
            },
            body: JSON.stringify({
                type: "business",
                email: email,
                full_name: fullName,
                redirect_url: baseUrl
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Bridge API Error:", JSON.stringify(data));
            throw new Error(data.message || JSON.stringify(data));
        }

        // Bridge returns: { kyc_link, tos_link, customer_id, ... }
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Create KYB Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
