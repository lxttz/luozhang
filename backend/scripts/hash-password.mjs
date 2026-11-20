const ITERATIONS = 100000;
const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return Buffer.from(binary, 'binary').toString('base64url');
}

const password = process.argv[2];
if (!password) {
  console.error('用法：node scripts/hash-password.mjs 你的密码');
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  key,
  256,
);
console.log(`pbkdf2$${ITERATIONS}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`);
