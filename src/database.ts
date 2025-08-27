// for now, the "database" is just in-memory

type ThreadStatus = 'connecting' | 'connected' | 'closed'

type ThreadRecord = {
  id: string // `${service}|...`
  status: ThreadStatus
}
const threads = new Set<ThreadRecord>()

type ChatRecord = {
  thread1: { id: string }
  thread2: { id: string }
}
const chats = new Set<ChatRecord>()

globalThis._db = { threads, chats } // for debugging

function getThread(id: string) {
  let foundThread: ThreadRecord | undefined
  threads.forEach((t) => {
    if (t.id === id) {
      foundThread = t
    }
  })
  return foundThread
}
function getChat(id: string) {
  let foundChat: ChatRecord | undefined
  chats.forEach((c) => {
    if (c.thread1.id === id || c.thread2.id === id) {
      foundChat = c
    }
  })
  return foundChat
}

export function newThread(thread: string) {
  threads.add({ id: thread, status: 'connecting' })
}

/**
 * Try to connect a thread to another and make a chat
 * @returns if success, the other thread's id
 */
export function tryConnect(thread: string) {
  const threadRecord = getThread(thread)
  if (!threadRecord) {
    throw new Error(`Thread not found: ${thread}`)
  }
  if (threadRecord.status !== 'connecting') {
    throw new Error(`Thread not in connecting state: ${thread}`)
  }

  // find another thread to connect to
  let otherThread: ThreadRecord | undefined
  threads.forEach((t) => {
    if (t.status === 'connecting' && t.id !== thread) {
      otherThread = t
    }
  })
  if (!otherThread) {
    return null
  }

  otherThread.status = 'connected'
  threadRecord.status = 'connected'
  chats.add({ thread1: threadRecord, thread2: otherThread })

  return otherThread.id
}

export function getOtherThread(thread: string) {
  const chat = getChat(thread)
  if (!chat) {
    return null
  }
  return chat.thread1.id === thread ? chat.thread2.id : chat.thread1.id
}
