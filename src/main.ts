import { ChatClient } from 'simplex-chat'
import { SimpleXBot } from './simplex'
import Slack from '@slack/bolt'
import { SlackBot } from './slack'
import * as database from './database'
import type { Message } from './abstract-service'

const simpleX = new SimpleXBot(await ChatClient.create('ws://localhost:5225'))
const slack = new SlackBot(
  new Slack.App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  })
)
const services = [simpleX, slack]

await Promise.all(services.map((s) => s.start()))

const simpleXAddress = simpleX.address
if (!simpleXAddress) {
  throw new Error('SimpleX bot address not set')
}

// Main bot loop

function getService(thread: string) {
  const serviceName = thread.split('|')[0]
  const service = services.find((s) => s.name === serviceName)
  if (!service) {
    throw new Error(`Service not found: ${serviceName}`)
  }
  return service
}

for (const service of services) {
  service.on('newThread', async (thread, userId) => {
    await database.newThread(thread, userId)

    const result = await database.tryConnect(thread)
    if (result !== null) {
      // mark chat as active on connect
      database.touchChat(thread)
      service.sendMessage(
        {
          text: `Connected!\nSend STOP to close the chat.`,
        },
        thread
      )
      service.setStatus(thread, 'connected')

      const resultService = getService(result)
      resultService.sendMessage(
        {
          text: `Connected!`,
        },
        result
      )
      resultService.setStatus(result, 'connected')
    } else {
      service.setStatus(thread, 'connecting')
      service.sendMessage(
        {
          text: `Waiting for another user to connect...\nSend STOP to close the chat.`,
        },
        thread
      )
    }
  })

  service.on('message', async (content, thread) => {
    try {
      // Handle STOP to close the chat
      if (content.text && content.text.trim() === 'STOP') {
        const otherThread = await database.closeChat(thread)
        // Notify both sides
        if (otherThread) {
          service.sendMessage({ text: 'Chat closed.' }, thread)
          service.setStatus(thread, 'closed')
          const otherService = getService(otherThread)
          otherService.sendMessage(
            { text: 'The other user has closed the chat.' },
            otherThread
          )
          otherService.setStatus(otherThread, 'closed')
        } else {
          service.sendMessage({ text: 'Search cancelled.' }, thread)
          service.setStatus(thread, 'closed')
        }
        return
      }
      const threadInfo = await database.getThread(thread)
      if (!threadInfo) {
        service.sendMessage(
          {
            text: `Thread not found in the database. Please start a new chat.`,
          },
          thread
        )
        service.setStatus(thread, 'closed')
        return
      }

      if (threadInfo.status === 'connected') {
        const otherThread = await database.getOtherThread(thread)
        if (otherThread !== null) {
          // forward message to the other person
          const otherService = getService(otherThread)
          otherService.sendMessage(content, otherThread)
          database.touchChat(thread)
          database.touchChat(otherThread)
        }
        return
      }
      if (threadInfo.status === 'connecting') {
        await service.sendMessage(
          {
            text: `No one is connected to this chat. Please wait for another user to connect.`,
          },
          thread
        )
        return
      }
      if (threadInfo.status === 'closed') {
        await service.sendMessage(
          {
            text: `This chat is closed. Please start a new chat.`,
          },
          thread
        )
        return
      }
      throw new Error('Unknown status')
    } catch (error) {
      console.error(error)
      await service.sendMessage(
        {
          text: `An error occurred while processing your message.`,
        },
        thread
      )
    }
  })
}
