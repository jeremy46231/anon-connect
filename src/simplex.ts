import {
  ChatClient,
  // ChatType,
  // Profile,
  // ChatInfoType,
  // ChatResponse,
  // ciContentText,
  // User,
} from 'simplex-chat'
import { AbstractService, type Message } from './abstract-service'
import { T as SimplexTypes, ChatEvent } from '@simplex-chat/types'
import { apiContactInfo, apiCreateLink } from './helpers'

function couldBeIncognito(profile: SimplexTypes.Profile) {
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
  private botUser?: SimplexTypes.User
  address?: string

  // thread id = `${this.name}|${contactId.toFixed()}`

  private async handleChatEvent(response: ChatEvent) {
    switch (response.type) {
      case 'contactConnected': {
        const isThread = response.userCustomProfile !== undefined
        // console.log(
        //   `${response.contact.profile.displayName} connected to ${
        //     isThread ? 'thread' : 'main chat'
        //   }`
        // )

        const contactId = response.contact.contactId

        if (!isThread) {
          let messages: string[] = [
            // 'Hello!',
            'Send any message to create a new chat.',
            'If you use an Incognito profile to accept the invites, the system will not be able to prevent you connecting to the same person repeatedly. If you are concerned about your display name being visible to the bot, you can make a new profile for AnonConnect. Regardless of what profile you use, you will always be anonymous.',
          ]

          try {
            await this.chat.apiSendMessages(
              SimplexTypes.ChatType.Direct,
              contactId,
              messages.map((text) => ({
                msgContent: { type: 'text', text },
                mentions: {},
              }))
            )
          } catch (err) {
            console.error('SimpleX: failed to send welcome messages:', err)
          }

          // try {
          //   await this.chat.apiSetContactPrefs(contactId, {
          //     commands: [
          //       {
          //         type: 'command',
          //         keyword: 'connect',
          //         label: 'Create a new chat',
          //       },
          //     ],
          //   })
          // } catch (err) {
          //   console.error('SimpleX: failed to set contact prefs:', err)
          // }
        } else {
          const threadId = `${this.name}|${contactId.toFixed()}`
          // const userId = couldBeIncognito(response.contact.profile)
          //   ? undefined
          //   : ...
          const userId = `${this.name}|${
            response.contact.profile.displayName ||
            response.contact.profile.fullName
          }`
          this.emit('newThread', threadId, userId)
        }

        return
      }
      case 'newChatItems': {
        for (const { chatInfo, chatItem } of response.chatItems) {
          try {
            if (chatInfo.type !== 'direct') continue
            if (chatItem.content.type !== 'rcvMsgContent') continue

            console.log(chatInfo)
            const contactId = chatInfo.contact.contactId
            const contactInfo = await apiContactInfo(this.chat, contactId)
            const isThread = contactInfo.customUserProfile !== undefined

            if (!isThread) {
              const msg = chatItem.content.msgContent.text ?? ''

              try {
                if (!this.botUser) {
                  throw new Error('no bot user')
                }
                const link = await apiCreateLink(
                  this.chat,
                  this.botUser.userId,
                  true
                )
                await this.chat.apiSendTextMessage(
                  SimplexTypes.ChatType.Direct,
                  contactId,
                  `New chat: ${link}`
                )
              } catch (err) {
                console.error(
                  'SimpleX: failed to create or send new chat link:',
                  err,
                  'msg:',
                  msg
                )
              }
            } else {
              const threadId = `${this.name}|${contactId.toFixed()}`
              this.emit(
                'message',
                { text: chatItem.content.msgContent.text ?? '' },
                threadId
              )
            }
          } catch (err) {
            console.error('SimpleX: error handling newChatItems entry:', err)
          }
        }
        return
      }
      case 'contactDeletedByContact': {
        const contactId = response.contact.contactId
        const threadId = `${this.name}|${contactId.toFixed()}`
        this.emit('closeThread', threadId)
        return
      }
    }
  }

  async start() {
    try {
      this.botUser = await this.chat.apiGetActiveUser()
    } catch (err) {
      console.error('SimpleX: failed to get active user:', err)
      throw err
    }
    if (!this.botUser) {
      throw new Error('no profile')
    }
    const userId = this.botUser.userId
    console.log(`SimpleX display name: ${this.botUser.profile.displayName}`)
    try {
      this.address =
        (await this.chat.apiGetUserAddress(userId)) ||
        (await this.chat.apiCreateUserAddress(userId))
    } catch (err) {
      console.error('SimpleX: failed to get or create user address:', err)
      throw err
    }
    console.log(`SimpleX address: ${this.address}`)

    try {
      await this.chat.enableAddressAutoAccept(userId, {
        type: 'text',
        text: 'Hello! This is the AnonConnect bot.\nhttps://github.com/jeremy46231/anon-connect\nMade by @Jeremy, jer.app',
      })
    } catch (err) {
      console.error('SimpleX: failed to enable address auto-accept:', err)
    }
    ;(async () => {
      for await (const response of this.chat.msgQ) {
        this.handleChatEvent(response).catch((error) => {
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
    try {
      await this.chat.apiSendTextMessage(
        SimplexTypes.ChatType.Direct,
        parseInt(id, 10),
        content.text
      )
    } catch (err) {
      console.error('SimpleX: failed to send message:', err, 'thread:', thread)
    }
  }

  async closeChat(thread: string): Promise<void> {
    try {
      const [service, id] = thread.split('|')
      if (service !== this.name) {
        throw new Error(
          `${this.name} cannot close thread of service ${service}`
        )
      }
      try {
        await this.chat.apiDeleteChat(
          SimplexTypes.ChatType.Direct,
          parseInt(id, 10),
          {
            type: 'entity',
            notify: true,
          }
        )
      } catch (err) {
        console.error('SimpleX: failed to delete chat:', err, 'thread:', thread)
      }
    } catch (error) {
      console.error('Error closing chat:', error)
    }
  }
}
