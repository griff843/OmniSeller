import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'enc:v1';

type Keyring = Record<string, Buffer>;

function loadKeyring(): Keyring {
  const raw = process.env.OMNISELLER_TOKEN_ENCRYPTION_KEYS;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('OMNISELLER_TOKEN_ENCRYPTION_KEYS is required in production');
    return {};
  }

  const parsed = JSON.parse(raw) as Record<string, string>;
  return Object.fromEntries(Object.entries(parsed).map(([id, encoded]) => {
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new Error(`Provider-token key ${id} must decode to exactly 32 bytes`);
    return [id, key];
  }));
}

export function activeProviderTokenKeyId(): string {
  const id = process.env.OMNISELLER_TOKEN_ACTIVE_KEY_ID;
  if (!id && process.env.NODE_ENV === 'production') throw new Error('OMNISELLER_TOKEN_ACTIVE_KEY_ID is required in production');
  return id ?? 'development-plaintext';
}

export function encryptProviderToken(value: string | null | undefined): { value: string | null; keyId: string | null } {
  if (!value) return { value: null, keyId: null };
  const keys = loadKeyring();
  const keyId = activeProviderTokenKeyId();
  const key = keys[keyId];
  if (!key) {
    if (process.env.NODE_ENV === 'production') throw new Error(`Active provider-token key ${keyId} is unavailable`);
    return { value, keyId: null };
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('omniseller:marketplace-token:v1'));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    value: [PREFIX, keyId, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':'),
    keyId,
  };
}

export function decryptProviderToken(value: string | null | undefined, options?: { allowLegacyPlaintext?: boolean }): string | null {
  if (!value) return null;
  if (!value.startsWith(`${PREFIX}:`)) {
    if (process.env.NODE_ENV === 'production' && !options?.allowLegacyPlaintext) throw new Error('Refusing to use a legacy plaintext provider token in production');
    return value;
  }

  const [, , keyId, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(':');
  if (!keyId || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Malformed encrypted provider token');
  const key = loadKeyring()[keyId];
  if (!key) throw new Error(`Provider-token key ${keyId} is unavailable`);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'));
  decipher.setAAD(Buffer.from('omniseller:marketplace-token:v1'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64url')), decipher.final()]).toString('utf8');
}

export function isEncryptedProviderToken(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(`${PREFIX}:`));
}
