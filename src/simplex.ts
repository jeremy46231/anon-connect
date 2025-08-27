import {
  ChatClient,
  ChatType,
  Profile,
  ChatInfoType,
  ChatResponse,
  ciContentText,
  User,
} from 'simplex-chat'
import { AbstractService, type Message } from './abstract-service'

function couldBeIncognito(profile: Profile) {
  if (profile.contactLink) return false
  if (profile.fullName !== '') return false
  if (profile.image) return false
  const randomNameRegex = /^[A-Z][a-z]*[A-Z][a-z]*$/
  if (!randomNameRegex.test(profile.displayName)) return false

  return true
}

export class SimpleXBot extends AbstractService {
  name = 'SimpleX' as const
  constructor(private chat: ChatClient) {
    super()
  }
  private botUser?: User
  address?: string

  // thread id = `${this.name}|${contactId.toFixed()}`

  private async handleChatResponse(response: ChatResponse) {
    switch (response.type) {
      case 'contactConnected': {
        const isThread = response.userCustomProfile !== undefined
        console.log(
          `${response.contact.profile.displayName} connected to ${
            isThread ? 'thread' : 'main chat'
          }`
        )

        const contactId = response.contact.contactId

        if (!isThread) {
          let messages: string[] = [
            // 'Hello!',
            "Send /'connect' to create a new chat.",
            "(If you're not on the SimpleX beta, ignore the apostrophes your client renders.)",
          ]

          await this.chat.apiSendMessages(
            ChatType.Direct,
            contactId,
            messages.map((text) => ({ msgContent: { type: 'text', text } }))
          )

          await this.chat.apiSetContactPrefs(contactId, {
            commands: [
              {
                type: 'command',
                keyword: 'connect',
                label: 'Create a new chat',
              },
            ],
          })
        } else {
          // await this.chat.apiSendTextMessage(
          //   ChatType.Direct,
          //   contactId,
          //   'New chat created.'
          // )
          const threadId = `${this.name}|${contactId.toFixed()}`
          this.emit('newThread', threadId)
        }

        return
      }
      case 'newChatItems': {
        for (const { chatInfo, chatItem } of response.chatItems) {
          if (chatInfo.type !== ChatInfoType.Direct) continue
          if (chatItem.content.type !== 'rcvMsgContent') continue

          const contactId = chatInfo.contact.contactId
          const [, customProfile] = await this.chat.apiContactInfo(contactId)
          const isThread = customProfile !== undefined

          if (!isThread) {
            const msg = ciContentText(chatItem.content)

            // if (msg === '/connect') {
            if (!this.botUser) {
              throw new Error('no bot user')
            }
            const link = await this.chat.apiAddContact(
              this.botUser.userId,
              true
            )
            await this.chat.apiSendTextMessage(
              ChatType.Direct,
              contactId,
              `New chat: ${link}`
            )
            // }
          } else {
            const threadId = `${this.name}|${contactId.toFixed()}`
            this.emit(
              'message',
              { text: ciContentText(chatItem.content) ?? '' },
              threadId
            )
          }
        }
      }
    }
  }

  async start() {
    this.botUser = await this.chat.apiGetActiveUser()
    if (!this.botUser) {
      throw new Error('no profile')
    }
    const userId = this.botUser.userId
    console.log(`SimpleX display name: ${this.botUser.profile.displayName}`)
    this.address =
      (await this.chat.apiGetUserAddress()) ||
      (await this.chat.apiCreateUserAddress())
    console.log(`SimpleX address: ${this.address}`)

    await this.chat.enableAddressAutoAccept(false, {
      type: 'text',
      text: 'Hello!\nYou probably want to start this chat with an Incognito profile.\nBot made by @Jeremy, jer.app',
    })
    ;(async () => {
      for await (const response of this.chat.msgQ) {
        this.handleChatResponse(response).catch((error) => {
          debugger
          console.error('Error handling chat response:', error)
        })
      }
    })()
    this.botRunning = true
  }

  async sendMessage(content: Message, thread: string): Promise<void> {
    const [service, id] = thread.split('|')
    if (service !== this.name) {
      throw new Error(
        `${this.name} cannot send to thread of service ${service}`
      )
    }
    await this.chat.apiSendMessages(ChatType.Direct, parseInt(id, 10), [
      { msgContent: { type: 'text', text: content.text } },
    ])
  }
}
