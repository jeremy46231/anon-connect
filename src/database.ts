import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function newThread(threadId: string, userId?: string) {
  await prisma.thread.upsert({
    where: { id: threadId },
    update: {},
    create: {
      id: threadId,
      status: 'connecting',
      userId,
    },
  })
}
export async function getThread(threadId: string) {
  return await prisma.thread.findUnique({
    where: { id: threadId },
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

  // Gather userIds we should avoid pairing with, based on recent chats
  const now = new Date()
  const cutoff = new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes
  const blockedUserIds = new Set<string>()
  if (threadRecord.userId) {
    const recentChats = await prisma.chat.findMany({
      where: {
        lastActive: { gte: cutoff },
        OR: [
          { thread1: { userId: threadRecord.userId } },
          { thread2: { userId: threadRecord.userId } },
        ],
      },
      include: {
        thread1: { select: { userId: true } },
        thread2: { select: { userId: true } },
      },
    })
    for (const chat of recentChats) {
      const u1 = chat.thread1.userId
      const u2 = chat.thread2.userId
      const other = u1 === threadRecord.userId ? u2 : u1
      if (other) blockedUserIds.add(other)
    }
  }

  // Find candidate threads to connect to (basic database-side filters)
  const candidates = await prisma.thread.findMany({
    where: {
      status: 'connecting',
      id: { not: threadId },
      ...(threadRecord.userId ? { userId: { not: threadRecord.userId } } : {}),
    },
    take: 50,
  })

  // Refine candidates in memory to exclude recently-chatted userIds
  const acceptable = candidates.filter((t) => {
    if (!t.userId) return true // no userId, allow
    if (blockedUserIds.size === 0) return true
    return !blockedUserIds.has(t.userId)
  })
  if (acceptable.length === 0) {
    return null
  }

  // randomly pick one
  const otherThread = acceptable[Math.floor(Math.random() * acceptable.length)]

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

export async function getChat(threadId: string) {
  return prisma.chat.findFirst({
    where: { OR: [{ thread1Id: threadId }, { thread2Id: threadId }] },
  })
}

export async function markUwuOptIn(threadId: string) {
  const chat = await prisma.chat.findFirst({
    where: { OR: [{ thread1Id: threadId }, { thread2Id: threadId }] },
  })
  if (!chat) return false

  const isThread1 = chat.thread1Id === threadId
  const updated = await prisma.chat.update({
    where: { id: chat.id },
    data: isThread1 ? { uwuOptInThread1: true } : { uwuOptInThread2: true },
  })
  return (updated.uwuOptInThread1 && updated.uwuOptInThread2) || false
}

export async function isUwuModeActive(threadId: string) {
  const chat = await prisma.chat.findFirst({
    where: { OR: [{ thread1Id: threadId }, { thread2Id: threadId }] },
    select: { uwuMode: true },
  })
  return chat?.uwuMode ?? false
}

export async function enableUwuModeForChat(threadId: string) {
  const chat = await prisma.chat.findFirst({
    where: { OR: [{ thread1Id: threadId }, { thread2Id: threadId }] },
  })
  if (!chat) return false
  await prisma.chat.update({
    where: { id: chat.id },
    data: { uwuMode: true },
  })
  return true
}

export async function disableUwuModeForChat(threadId: string) {
  const chat = await prisma.chat.findFirst({
    where: { OR: [{ thread1Id: threadId }, { thread2Id: threadId }] },
  })
  if (!chat) return false
  await prisma.chat.update({
    where: { id: chat.id },
    data: { uwuMode: false, uwuOptInThread1: false, uwuOptInThread2: false },
  })
  return true
}

/**
 * Close the chat for the given thread id.
 * - If a chat exists, both threads are marked as 'closed' and the chat record is deleted.
 * - If no chat exists, the single thread (if present) is marked as 'closed'.
 * @param threadId Thread id of one side of the chat
 * @returns the other thread id if there was a chat, otherwise null
 */
export async function closeChat(threadId: string) {
  // Find the chat that involves this thread
  const chat = await prisma.chat.findFirst({
    where: {
      OR: [{ thread1Id: threadId }, { thread2Id: threadId }],
    },
  })

  if (!chat) {
    // No chat record: just close this thread if it exists
    try {
      await prisma.thread.update({
        where: { id: threadId },
        data: { status: 'closed' },
      })
    } catch {
      // ignore if thread does not exist
    }
    return null
  }

  const otherThreadId =
    chat.thread1Id === threadId ? chat.thread2Id : chat.thread1Id

  // Close both threads in a transaction
  await prisma.$transaction([
    prisma.thread.update({
      where: { id: chat.thread1Id },
      data: { status: 'closed' },
    }),
    prisma.thread.update({
      where: { id: chat.thread2Id },
      data: { status: 'closed' },
    }),
  ])

  return otherThreadId
}

/**
 * Update the lastActive timestamp for the chat that includes the given thread id.
 */
export async function touchChat(threadId: string) {
  const chat = await prisma.chat.findFirst({
    where: { OR: [{ thread1Id: threadId }, { thread2Id: threadId }] },
    select: { id: true },
  })
  if (!chat) return
  await prisma.chat.update({
    where: { id: chat.id },
    data: { lastActive: new Date() },
  })
}
