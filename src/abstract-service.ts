import { TypedEmitter } from './helpers'

export type Message = {
  text: string
}

type ServiceEvents = {
  message: (content: Message, thread: string) => void
  newThread: (thread: string, userId?: string) => void
  closeThread: (thread: string) => void
}

export abstract class AbstractService<
  Events extends ServiceEvents = ServiceEvents
> extends TypedEmitter<Events> {
  abstract name: string
  protected botRunning = false

  abstract start(): Promise<void>

  abstract sendMessage(content: Message, thread: string): Promise<void>

  async setStatus(thread: string, status: string): Promise<void> {}
  async closeChat(thread: string): Promise<void> {}
}
