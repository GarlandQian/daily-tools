import { PrismaClient } from '@prisma/client'

const prisma = (globalThis as unknown as { prisma: PrismaClient }).prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') (globalThis as unknown as { prisma: PrismaClient }).prisma = prisma

export default prisma
