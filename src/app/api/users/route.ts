import prisma from '@prisma/index'

export async function GET() {
  try {
    const users = await prisma.user.findMany()
    return new Response(JSON.stringify(users), { status: 200 })
  } catch (error) {
    console.log(error)
    return new Response(JSON.stringify({ error: '数据库查询失败' }), {
      status: 500
    })
  }
}
