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

async function sendMessage(message: Message, thread: string) {
  const serviceName = thread.split('|')[0]
  const service = services.find((s) => s.name === serviceName)
  if (!service) {
    throw new Error(`Service not found: ${serviceName}`)
  }
  return await service.sendMessage(message, thread)
}

for (const service of services) {
  service.on('newThread', async (thread) => {
    await database.newThread(thread)

    const result = await database.tryConnect(thread)
    if (result !== null) {
      await service.sendMessage(
        {
          text: `Connected! You can start chatting with the other user now.`,
        },
        thread
      )
      await sendMessage(
        {
          text: `Connected! You can start chatting with the other user now.`,
        },
        result
      )
    } else {
      await service.sendMessage(
        {
          text: `Waiting for another user to connect...`,
        },
        thread
      )
    }
  })

  service.on('message', async (content, thread) => {
    const otherThread = await database.getOtherThread(thread)
    if (otherThread !== null) {
      await sendMessage(content, otherThread)
      return
    }
    await service.sendMessage(
      {
        text: `No one is connected to this chat. Please wait for another user to connect.`,
      },
      thread
    )
  })
}
