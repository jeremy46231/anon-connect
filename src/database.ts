import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function newThread(threadId: string) {
  await prisma.thread.create({
    data: {
      id: threadId,
      status: 'connecting',
    },
  })
}

/**
 * Try to connect a thread to another and make a chat
 * @returns if success, the other thread's id
 */
export async function tryConnect(threadId: string) {
  const threadRecord = await prisma.thread.findUnique({
    where: { id: threadId },
  })

  if (!threadRecord) {
    throw new Error(`Thread not found: ${threadId}`)
  }
  if (threadRecord.status !== 'connecting') {
    throw new Error(`Thread not in connecting state: ${threadId}`)
  }

  // Find another thread to connect to
  const otherThread = await prisma.thread.findFirst({
    where: {
      status: 'connecting',
      NOT: { id: threadId },
    },
  })

  if (!otherThread) {
    return null
  }

  // Use a transaction to ensure both threads are updated and the chat is created atomically.
  // This prevents race conditions.
  await prisma.$transaction([
    // Update both threads to 'connected'
    prisma.thread.update({
      where: { id: threadRecord.id },
      data: { status: 'connected' },
    }),
    prisma.thread.update({
      where: { id: otherThread.id },
      data: { status: 'connected' },
    }),
    // Create the chat record linking the two threads
    prisma.chat.create({
      data: {
        thread1Id: threadRecord.id,
        thread2Id: otherThread.id,
      },
    }),
  ])

  return otherThread.id
}

export async function getOtherThread(threadId: string) {
  const chat = await prisma.chat.findFirst({
    where: {
      OR: [{ thread1Id: threadId }, { thread2Id: threadId }],
    },
  })

  if (!chat) {
    return null
  }

  return chat.thread1Id === threadId ? chat.thread2Id : chat.thread1Id
}
