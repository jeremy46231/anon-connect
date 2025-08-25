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
      const { contact } = response
      const incognito = couldBeIncognito(contact.profile)
      console.log(
        `${contact.profile.displayName} connected, ${
          incognito ? 'incognito' : 'not incognito'
        }`
      )

      let messages: string[] = ['Hello!']

      const profileLink = contact.profile.contactLink
      let workingProfileLink = false
      if (profileLink) {
        try {
          const plan = await chat.apiConnectPlan(user!.userId, profileLink)
          if (plan.connectionPlan.type === 'contactAddress') {
            workingProfileLink = true
            messages.push(
              'Your current profile has a shared address, this will be used to start new chats with you.'
            )
          }
        } catch (error) {
          console.error('Error with profile link:', error)
        }
      }
      if (!workingProfileLink) {
        messages.push(
          `${
            profileLink
              ? 'It looks like you have a broken address attached to your profile, it will be ignored.'
              : incognito
              ? "Because this chat is incognito, I don't yet have permission to start new chats with you."
              : 'Your profile does not have an address link set to be shared with contacts.'
          } Use /invite to set the link to use to start chats for your conversations. You need to either set an address link or set a one-time invite link each time you start a chat.`
        )
      }

      messages.push('WIP :)')

      await chat.apiSendMessages(
        ChatType.Direct,
        contact.contactId,
        messages.map((text) => ({ msgContent: { type: 'text', text } }))
      )

      // TODO: more info in intro messages
      // TODO: create a record in the database to track this chat

      return
    }
    case 'newChatItems': {
      for (const { chatInfo, chatItem } of response.chatItems) {
        if (chatInfo.type !== ChatInfoType.Direct) continue

        const msg = ciContentText(chatItem.content)
        // if (msg) {
        //   const n = +msg
        //   const reply =
        //     typeof n === 'number' && !isNaN(n)
        //       ? `${n} * ${n} = ${n * n}`
        //       : `this is not a number`
        //   await chat.apiSendTextMessage(
        //     ChatType.Direct,
        //     chatInfo.contact.contactId,
        //     reply
        //   )
        // }

        if (msg === 'connect') {
          const link = chatInfo.contact.profile.contactLink
          console.log('link', { link })
          if (link) {
            // const res = await chat.apiConnect(link)
            // console.log('connected', res)
            const plan = await chat.apiConnectPlan(user!.userId, link)
            if (
              plan.connectionPlan.type !== 'contactAddress' &&
              plan.connectionPlan.type !== 'invitationLink'
            ) {
              let errorText = 'This is an invalid link type.'
              if (plan.connectionPlan.type === 'groupLink') {
                errorText = 'This is a group link, not a direct link.'
              }
              await chat.apiSendTextMessage(
                ChatType.Direct,
                chatInfo.contact.contactId,
                errorText
              )
              return
            }
            // the link is good
          }
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
