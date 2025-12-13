
'use server'

import prisma from '../../prisma'

export interface CreateHistoryDto {
  tool: string
  content: string
  result: string
  options?: Record<string, unknown>
  status?: string
}

export async function saveHistory(data: CreateHistoryDto) {
  try {
    const history = await prisma.decryptionHistory.create({
      data: {
        tool: data.tool,
        content: data.content,
        result: data.result,
        options: data.options ?? {},
        status: data.status ?? 'SUCCESS',
      },
    })
    return { success: true, data: history }
  } catch (error) {
    console.error('Failed to save history:', error)
    return { success: false, error: 'Failed to save history' }
  }
}

export async function getHistory(tool: string, limit: number = 20) {
  try {
    const history = await prisma.decryptionHistory.findMany({
      where: { tool },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return { success: true, data: history }
  } catch (error) {
    console.error('Failed to fetch history:', error)
    return { success: false, error: 'Failed to fetch history' }
  }
}

export async function clearHistory(tool: string) {
  try {
    await prisma.decryptionHistory.deleteMany({
      where: { tool },
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to clear history:', error)
    return { success: false, error: 'Failed to clear history' }
  }
}
export async function findHistoryByResult(tool: string, result: string) {
  try {
    const history = await prisma.decryptionHistory.findFirst({
      where: {
        tool,
        result,
        status: 'SUCCESS', // Only return successful encryptions/generations
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: history }
  } catch (error) {
    console.error('Failed to find history by result:', error)
    return { success: false, error: 'Failed to find history' }
  }
}
