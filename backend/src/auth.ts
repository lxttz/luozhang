import type { Context, Next } from 'hono';
import type { AppEnv, JwtPayload } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 100_000;

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(value: string): Uint8Array {
  let input = value.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${ITERATIONS}$${base64urlEncode(salt)}$${base64urlEncode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationText, saltText, hashText] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterationText || !saltText || !hashText) return false;
  const iterations = Number(iterationText);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = base64urlDecode(saltText);
  const expected = base64urlDecode(hashText);
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    expected.length * 8,
  );
  return timingSafeEqual(new Uint8Array(bits), expected);
}

export async function signToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = 7 * 24 * 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const header = base64urlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadPart = base64urlEncode(encoder.encode(JSON.stringify(body)));
  const content = `${header}.${payloadPart}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(content));
  return `${content}.${base64urlEncode(new Uint8Array(signature))}`;
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const content = `${parts[0]}.${parts[1]}`;
  const signature = base64urlDecode(parts[2]);
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signature, encoder.encode(content));
  if (!valid) return null;
  try {
    const payload = JSON.parse(decoder.decode(base64urlDecode(parts[1]))) as JwtPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const requireAuth = async (c: Context<AppEnv>, next: Next) => {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return c.json({ message: '未登录，请先登录' }, 401);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ message: '登录已过期，请重新登录' }, 401);
  c.set('user', payload);
  await next();
};

export const requireBoss = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('user')?.role !== 'boss') return c.json({ message: '仅老板可以执行此操作' }, 403);
  await next();
};

export const requireFinance = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('user')?.role !== 'finance') return c.json({ message: '仅财务可以执行此操作' }, 403);
  await next();
};
