// AES-GCM encryption for offline lesson note storage
// Uses the Web Crypto API — no external dependencies

const ALGO = 'AES-GCM';
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt'];

async function getKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGO, length: 256 },
    false,
    KEY_USAGE
  );
}

export async function encrypt(plaintext: string, userId: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(userId, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, enc.encode(plaintext));

  // Pack: salt(16) + iv(12) + ciphertext → base64
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encoded: string, userId: string): Promise<string> {
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const key = await getKey(userId, salt);
  const plainBuffer = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuffer);
}

export function generateId(): string {
  return crypto.randomUUID();
}
