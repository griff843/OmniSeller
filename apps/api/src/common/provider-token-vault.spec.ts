import { decryptProviderToken, encryptProviderToken, isEncryptedProviderToken } from './provider-token-vault';

describe('provider token vault', () => {
  const prior = process.env;
  beforeEach(() => {
    process.env = { ...prior, NODE_ENV: 'test', OMNISELLER_TOKEN_ACTIVE_KEY_ID: 'test-v1', OMNISELLER_TOKEN_ENCRYPTION_KEYS: JSON.stringify({ 'test-v1': Buffer.alloc(32, 7).toString('base64') }) };
  });
  afterAll(() => { process.env = prior; });

  it('round trips with AES-256-GCM and never retains plaintext', () => {
    const encrypted = encryptProviderToken('secret-refresh-token');
    expect(encrypted.keyId).toBe('test-v1');
    expect(isEncryptedProviderToken(encrypted.value)).toBe(true);
    expect(encrypted.value).not.toContain('secret-refresh-token');
    expect(decryptProviderToken(encrypted.value)).toBe('secret-refresh-token');
  });

  it('rejects tampering', () => {
    const encrypted = encryptProviderToken('secret').value!;
    expect(() => decryptProviderToken(`${encrypted.slice(0, -1)}x`)).toThrow();
  });
});
