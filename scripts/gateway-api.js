const GATEWAY_BASE = '/content/kotak-life/api/gateway';

async function getSessionKey() {
  const response = await fetch(`${GATEWAY_BASE}/key.json`, {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Gateway session key request failed (${response.status}).`);
  }

  const match = document.cookie.match(/(?:^|; )kli-gw-session-key=([^;]*)/);
  if (!match) throw new Error('Session key cookie missing after key request.');

  const rawKeyBytes = Uint8Array.from(
    atob(decodeURIComponent(match[1])),
    (character) => character.charCodeAt(0),
  );
  return crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptWithKey(cryptoKey, plaintext) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(plaintext),
  );
  const wire = new Uint8Array(12 + ciphertextWithTag.byteLength);
  wire.set(nonce, 0);
  wire.set(new Uint8Array(ciphertextWithTag), 12);
  return btoa(String.fromCharCode(...wire));
}

async function decryptWithKey(cryptoKey, base64Wire) {
  const wire = Uint8Array.from(atob(base64Wire), (character) => character.charCodeAt(0));
  const plaintextBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: wire.slice(0, 12), tagLength: 128 },
    cryptoKey,
    wire.slice(12),
  );
  return new TextDecoder().decode(plaintextBytes);
}

export default async function invokeGateway(gatewayKey, payload) {
  const cryptoKey = await getSessionKey();
  const encryptedPayload = await encryptWithKey(cryptoKey, JSON.stringify(payload));
  const response = await fetch(`${GATEWAY_BASE}/invoke.json`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gatewayKey, payload: encryptedPayload }),
  });
  if (!response.ok) {
    throw new Error(`Gateway request failed (${response.status}).`);
  }

  const envelope = await response.json();
  if (Number(envelope.status) >= 400) {
    throw new Error(envelope.message || envelope.error || 'The gateway request failed.');
  }
  if (typeof envelope.data === 'string') {
    envelope.data = JSON.parse(await decryptWithKey(cryptoKey, envelope.data));
  }
  return envelope;
}
