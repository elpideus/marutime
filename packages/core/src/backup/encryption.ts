import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('MTB1');

function deriveKey(passphrase: string): Buffer {
  return createHash('sha256').update(`marutime-backup:${passphrase}`).digest();
}

/** AES-256-GCM: MAGIC(4) | IV(12) | TAG(16) | CIPHERTEXT */
export function encryptBackup(plain: Uint8Array, passphrase: string): Uint8Array {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return new Uint8Array(Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]));
}

export function isEncryptedBackup(data: Uint8Array): boolean {
  return data.byteLength > 32 && Buffer.from(data.subarray(0, 4)).equals(MAGIC);
}

export function decryptBackup(data: Uint8Array, passphrase: string): Uint8Array {
  const buf = Buffer.from(data);
  if (!isEncryptedBackup(buf)) return data;
  const iv = buf.subarray(4, 16);
  const tag = buf.subarray(16, 32);
  const body = buf.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase), iv);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]));
}
