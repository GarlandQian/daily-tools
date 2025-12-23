
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const prismaClientSingleton = () => {
    return new PrismaClient({
        accelerateUrl: process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).$extends(withAccelerate())
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
