import crypto from 'crypto';
import type Database from 'better-sqlite3';

interface StoredMasterPassword {
  salt: string; // base64
  hash: string; // base64 derived key
}

let inMemoryKey: Buffer | null = null;
let isUnlocked = false;

const SETTINGS_KEY = 'master_password';
const ALGO = 'aes-256-gcm';

function deriveKey(password: string, salt: Buffer): Buffer {
  // 使用 scrypt 派生 32 字节密钥
  return crypto.scryptSync(password, salt, 32);
}

function getStored(db: Database.Database): StoredMasterPassword | null {
  try {
    const row = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(SETTINGS_KEY) as { value: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.value) as StoredMasterPassword;
  } catch (e) {
    console.error('Failed to read master password from settings:', e);
    return null;
  }
}

function saveStored(db: Database.Database, stored: StoredMasterPassword) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    SETTINGS_KEY,
    JSON.stringify(stored),
  );
}

export function setMasterPassword(db: Database.Database, password: string) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  saveStored(db, { salt: salt.toString('base64'), hash: key.toString('base64') });
  inMemoryKey = key;
  isUnlocked = true;
}

export function unlock(db: Database.Database, password: string): boolean {
  const stored = getStored(db);
  if (!stored) return false;
  const salt = Buffer.from(stored.salt, 'base64');
  const derived = deriveKey(password, salt);
  const storedHash = Buffer.from(stored.hash, 'base64');
  const ok = crypto.timingSafeEqual(derived, storedHash);
  if (ok) {
    inMemoryKey = derived;
    isUnlocked = true;
  }
  return ok;
}

export function lock() {
  inMemoryKey = null;
  isUnlocked = false;
}

export function getKey(): Buffer | null {
  return inMemoryKey;
}

export function securityStatus(db: Database.Database) {
  const stored = getStored(db);
  return {
    configured: !!stored,
    unlocked: isUnlocked,
  };
}

export function getUnlockedKey(): Buffer | null {
  return inMemoryKey;
}

export function encryptText(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString('base64');
  return `ENC::${payload}`;
}

export function decryptText(data: string, key: Buffer): string | null {
  if (!data || !data.startsWith('ENC::')) return data;
  try {
    const buf = Buffer.from(data.slice(5), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch (e) {
    console.error('Decrypt failed', e);
    return null;
  }
}

