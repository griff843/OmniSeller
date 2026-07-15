import { prisma } from '@omniseller/db';
import { decryptProviderToken, encryptProviderToken, isEncryptedProviderToken } from '../src/common/provider-token-vault';

async function main() {
  const allowLegacyPlaintext = process.env.OMNISELLER_ALLOW_PLAINTEXT_TOKEN_MIGRATION === 'true';
  const accounts = await prisma.marketplaceAccount.findMany({ select: { id: true, accessToken: true, refreshToken: true, tokenKeyId: true } });
  let rotated = 0;
  for (const account of accounts) {
    const access = decryptProviderToken(account.accessToken, { allowLegacyPlaintext });
    const refresh = decryptProviderToken(account.refreshToken, { allowLegacyPlaintext });
    const encryptedAccess = encryptProviderToken(access);
    const encryptedRefresh = encryptProviderToken(refresh);
    if (account.tokenKeyId === encryptedAccess.keyId && isEncryptedProviderToken(account.accessToken) && (!account.refreshToken || account.tokenKeyId === encryptedRefresh.keyId)) continue;
    await prisma.marketplaceAccount.update({ where: { id: account.id }, data: { accessToken: encryptedAccess.value, refreshToken: encryptedRefresh.value, tokenKeyId: encryptedAccess.keyId ?? encryptedRefresh.keyId } });
    rotated += 1;
  }
  console.log(JSON.stringify({ scanned: accounts.length, rotated }));
}

main().finally(() => prisma.$disconnect());
