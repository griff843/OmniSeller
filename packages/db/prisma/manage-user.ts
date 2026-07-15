import { prisma } from '../index.js';

async function main() {
  const [action, rawEmail, ...reasonParts] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!['invite', 'revoke', 'enable'].includes(action ?? '') || !email) throw new Error('Usage: pnpm db:user <invite|revoke|enable> seller@example.com [reason]');
  if (action === 'invite') {
    const user = await prisma.user.upsert({ where: { email }, create: { email, invitedAt: new Date() }, update: { invitedAt: new Date(), disabledAt: null, disabledReason: null } });
    console.log(JSON.stringify({ id: user.id, email: user.email, state: 'invited' }));
  } else if (action === 'revoke') {
    const user = await prisma.user.update({ where: { email }, data: { disabledAt: new Date(), disabledReason: reasonParts.join(' ').slice(0, 500) || 'Emergency revocation' } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    console.log(JSON.stringify({ id: user.id, email: user.email, state: 'revoked' }));
  } else {
    const user = await prisma.user.update({ where: { email }, data: { disabledAt: null, disabledReason: null } });
    console.log(JSON.stringify({ id: user.id, email: user.email, state: 'enabled' }));
  }
}
main().finally(() => prisma.$disconnect());
