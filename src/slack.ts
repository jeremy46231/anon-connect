import type Slack from '@slack/bolt'
import type { types as SlackTypes, webApi as SlackAPI } from '@slack/bolt'
import { AbstractService, type Message } from './abstract-service'

export class SlackBot extends AbstractService {
  name = 'Slack' as const
  constructor(private app: Slack.App, private port?: number | string) {
    super()
  }
  botId?: string

  // thread ID = `${this.name}|${dm id}|${top-level message ts}`

  async start() {
    const auth = await this.app.client.auth.test()
    if (!auth.bot_id) throw new Error('Failed to authenticate Slack bot')
    this.botId = auth.user_id
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

  async setStatus(thread: string, status: string) {
    const [service, channel, thread_ts] = thread.split('|')
    if (service !== this.name) {
      throw new Error(
        `${this.name} cannot set status for thread of service ${service}`
      )
    }
    // remove existing reactions
    const reactionsResponse = await this.app.client.reactions.get({
      channel,
      timestamp: thread_ts,
    })
    const reactions =
      reactionsResponse.message?.reactions
        ?.filter((r) => r.users?.includes(this.botId!))
        .map((r) => r.name)
        .filter((name) => name !== undefined) || []
    for (const reaction of reactions) {
      await this.app.client.reactions.remove({
        channel,
        timestamp: thread_ts,
        name: reaction,
      })
    }

    const statusEmojis: Record<string, string | undefined> = {
      connecting: 'hourglass_flowing_sand',
      connected: 'white_check_mark',
      closed: 'x',
    }
    const statusEmoji = statusEmojis[status]
    if (!statusEmoji) return

    await this.app.client.reactions.add({
      channel,
      timestamp: thread_ts,
      name: statusEmoji,
    })
  }
}
