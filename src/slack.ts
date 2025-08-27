import type Slack from '@slack/bolt'
import type { types as SlackTypes, webApi as SlackAPI } from '@slack/bolt'
import { AbstractService, type Message } from './abstract-service'

export class SlackBot extends AbstractService {
  name = 'Slack' as const
  constructor(private app: Slack.App, private port?: number | string) {
    super()
  }

  // thread ID = `${this.name}|${dm id}|${top-level message ts}`

  async start() {
    const auth = await this.app.client.auth.test()
    if (!auth.bot_id) throw new Error('Failed to authenticate Slack bot')
    console.log(`Slack logged in as ${auth.user_id}`)

    this.app.message(async ({ message }) => {
      if (message.channel_type !== 'im') return
      if (
        !(
          [
            // allowed message subtypes
            undefined,
            'bot_message',
            'file_share',
            'me_message',
          ] satisfies (typeof message.subtype)[] as (typeof message.subtype)[]
        ).includes(message.subtype)
      ) {
        return
      }

      if (!('thread_ts' in message)) {
        // top-level message, new thread
        const threadId = `${this.name}|${message.channel}|${message.ts}`
        const userId =
          'user' in message && message.user
            ? `${this.name}|${message.user}`
            : undefined
        this.emit('newThread', threadId, userId)
      } else {
        const threadId = `${this.name}|${message.channel}|${message.thread_ts}`
        this.emit(
          'message',
          {
            text: message.text || '',
          },
          threadId
        )
      }
    })

    if (this.port !== undefined) {
      await this.app.start(this.port)
    } else {
      await this.app.start()
    }
    this.botRunning = true
  }

  async sendMessage(content: Message, thread: string): Promise<void> {
    const [service, channel, thread_ts] = thread.split('|')
    if (service !== this.name) {
      throw new Error(
        `${this.name} cannot send to thread of service ${service}`
      )
    }
    await this.app.client.chat.postMessage({
      channel,
      thread_ts,
      text: content.text,
    })
  }
}
