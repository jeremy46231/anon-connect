import {
  ChatClient,
  ChatType,
  Profile,
  ChatInfoType,
  ChatResponse,
  ciContentText,
  User,
} from 'simplex-chat'

function couldBeIncognito(profile: Profile) {
  if (profile.contactLink) return false
  if (profile.fullName !== '') return false
  if (profile.image) return false
  const randomNameRegex = /^[A-Z][a-z]*[A-Z][a-z]*$/
  if (!randomNameRegex.test(profile.displayName)) return false

  return true
}

export class SimpleXBot {
  constructor(private chat: ChatClient) {}
  botUser: User | undefined
  botRunning = false

  private async handleChatResponse(response: ChatResponse) {
    switch (response.type) {
      case 'contactConnected': {
        const isMainChat = response.userCustomProfile === undefined
        console.log(
          `${response.contact.profile.displayName} connected to ${
            isMainChat ? 'main chat' : 'one-time link'
          }`
        )

        const contactId = response.contact.contactId

        if (isMainChat) {
          let messages: string[] = [
            'Hello!',
            "Send /'connect' to create a new chat.",
            "(If you're not on the SimpleX beta, ignore the apostrophes.)",
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
          await this.chat.apiSendTextMessage(
            ChatType.Direct,
            contactId,
            'New chat created.'
          )
          // TODO: store this chat contactId in the DB somehow
        }

        return
      }
      case 'newChatItems': {
        for (const { chatInfo, chatItem } of response.chatItems) {
          if (chatInfo.type !== ChatInfoType.Direct) continue

          const contactId = chatInfo.contact.contactId

          const isMainChat = true // TODO: look up contactId in database to see if this is a main chat

          if (isMainChat) {
            const msg = ciContentText(chatItem.content)

            if (msg === '/connect') {
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
            }
          } else {
            // TODO: handle proxying this message to the destination
          }
        }
      }
    }
  }

  async runBot() {
    try {
      this.botRunning = true

      this.botUser = await this.chat.apiGetActiveUser()
      if (!this.botUser) {
        throw new Error('no profile')
      }
      const userId = this.botUser.userId
      console.log(`Bot profile: ${this.botUser.profile.displayName}`)
      const address =
        (await this.chat.apiGetUserAddress()) ||
        (await this.chat.apiCreateUserAddress())
      console.log(`Address: ${address}`)

      await this.chat.enableAddressAutoAccept(false, {
        type: 'text',
        text: 'Hello!\nYou probably want to start this chat with an Incognito profile.\nBot made by @Jeremy, jer.app',
      })

      for await (const response of this.chat.msgQ) {
        ;(async () => {
          try {
            await this.handleChatResponse(response)
          } catch (error) {
            console.error('Error handling chat response:', error)
          }
        })()
      }
    } finally {
      this.botRunning = false
    }
  }
}
