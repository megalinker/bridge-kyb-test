import crypto from 'crypto';

export function verifyBridgeSignature(
  signatureHeader: string | null,
  rawBody: string,
  publicKeyPem: string
): boolean {
  if (!signatureHeader || !publicKeyPem) return false;

  try {
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v0='));

    if (!timestampPart || !signaturePart) return false;

    const t = timestampPart.substring(2);
    const v0 = signaturePart.substring(3);

    // Check freshness (10 mins)
    const now = Date.now();
    const eventTime = parseInt(t, 10);
    if (isNaN(eventTime) || Math.abs(now - eventTime) > 10 * 60 * 1000) {
      return false;
    }

    const signedPayload = `${t}.${rawBody}`;
    const verifier = crypto.createVerify('sha256');
    verifier.update(signedPayload);
    
    // Fix newlines if they were escaped in ENV vars
    const formattedKey = publicKeyPem.replace(/\\n/g, '\n');

    return verifier.verify(formattedKey, v0, 'base64');
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}