import crypto from 'crypto';

function normalizePem(pem?: string): string {
  if (!pem) return "";
  let s = pem.trim();

  // strip surrounding quotes if present (common in .env files)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
  }

  // support JSON-escaped newlines (fixes Vercel env var issues)
  s = s.replace(/\\n/g, "\n").replace(/\r/g, "");

  return s.trim();
}

export function verifyBridgeSignature(
  rawBody: string,
  signatureHeader: string | null,
  publicKeyPem?: string
): boolean {
  if (!publicKeyPem) {
    console.error("Missing BRIDGE_WEBHOOK_PUBLIC_KEY_PEM");
    return false;
  }
  if (!signatureHeader) {
    console.error("Missing signature header");
    return false;
  }

  const parts = signatureHeader.split(",").map(p => p.trim());
  const timestamp = parts.find(p => p.startsWith("t="))?.split("=", 2)[1];
  const signatureB64 = parts.find(p => p.startsWith("v0="))?.split("=", 2)[1];

  if (!timestamp || !signatureB64) {
    console.error("Invalid signature header format");
    return false;
  }

  // Replay guard (~10 minutes)
  if (Date.now() - Number(timestamp) > 10 * 60 * 1000) {
    console.error("Webhook timestamp stale");
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;

  try {
    const key = crypto.createPublicKey({ 
      key: normalizePem(publicKeyPem), 
      format: "pem" 
    });

    // 1) SHA256 over "<timestamp>.<rawBody>"
    const firstHash = crypto.createHash("sha256").update(Buffer.from(signedPayload, "utf8")).digest();

    // 2) RSA-SHA256 verify using the *hash bytes* as the message.
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(firstHash);
    verifier.end();

    const sig = Buffer.from(signatureB64, "base64");
    return verifier.verify(key, sig);
  } catch (e: any) {
    console.error(`Verification error: ${e?.message || e}`);
    return false;
  }
}