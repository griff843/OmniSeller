const prismaClient = require('@prisma/client');

const { PrismaClient, ...prismaExports } = prismaClient;
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__omnisellerPrisma ??
  new PrismaClient({
    log: ['info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__omnisellerPrisma = prisma;
}

module.exports = {
  prisma,
  ...prismaExports,
};
