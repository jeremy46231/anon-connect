import {
  ChatClient,
  ChatType,
  Profile,
  ChatInfoType,
  ChatResponse,
  ciContentText,
} from 'simplex-chat'

const simplex = await ChatClient.create('ws://localhost:5225')
const user = await simplex.apiGetActiveUser()
if (!user) {
  throw new Error('no profile')
}
const userId = user.userId
console.log(
  `Bot profile: ${user.profile.displayName} (${user.profile.fullName})`
)
const address =
  (await simplex.apiGetUserAddress()) || (await simplex.apiCreateUserAddress())
console.log(`Bot address: ${address}`)

function couldBeIncognito(profile: Profile) {
  if (profile.contactLink) return false
  if (profile.fullName !== '') return false
  if (profile.image) return false
  const randomNameRegex = /^[A-Z][a-z]*[A-Z][a-z]*$/
  if (!randomNameRegex.test(profile.displayName)) return false

  return true
}

async function handleChatResponse(response: ChatResponse, chat = simplex) {
  switch (response.type) {
    case 'contactConnected': {
      // sends welcome message when the new contact is connected
      const isMainChat = response.userCustomProfile === undefined
      const incognito = couldBeIncognito(response.contact.profile)
      console.log(
        `${response.contact.profile.displayName} connected ${
          isMainChat ? 'to main chat' : 'to one-time link'
        }, ${incognito ? 'incognito' : 'not incognito'}`
      )

      if (isMainChat) {
        let messages: string[] = ['Hello!', 'Send /\'connect\' to create a new chat']

        await chat.apiSendMessages(
          ChatType.Direct,
          response.contact.contactId,
          messages.map((text) => ({ msgContent: { type: 'text', text } }))
        )

        await chat.apiSetContactPrefs(response.contact.contactId, {
          commands: [
            {
              type: 'command',
              keyword: 'connect',
              label: 'Create a new chat',
            }
          ]
        })
      } else {
        await chat.apiSendTextMessage(
          ChatType.Direct,
          response.contact.contactId,
          'Welcome to the chat!'
        )
      }

      return
    }
    case 'newChatItems': {
      for (const { chatInfo, chatItem } of response.chatItems) {
        if (chatInfo.type !== ChatInfoType.Direct) continue

        const msg = ciContentText(chatItem.content)

        if (msg === '/connect') {
          const link = await chat.apiAddContact(userId, true)
          await chat.apiSendTextMessage(
            ChatType.Direct,
            chatInfo.contact.contactId,
            `New chat: ${link}`
          )
        }
      }
    }
  }
}

async function runBot(chat: ChatClient) {
  await chat.enableAddressAutoAccept(false, {
    type: 'text',
    text: 'Hello! Bot made by @Jeremy, jer.app',
  })
  for await (const response of chat.msgQ) {
    handleChatResponse(response, chat)
  }
}

await runBot(simplex)
