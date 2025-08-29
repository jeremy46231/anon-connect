import { ChatClient } from 'simplex-chat'
import { SimpleXBot } from './simplex'
import Slack from '@slack/bolt'
import { SlackBot } from './slack'
import * as database from './database'
import { uwuwify } from './helpers'

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

async function closeChat(thread: string, messageCloser = true) {
  const service = getService(thread)
  const otherThread = await database.closeChat(thread)
  // Notify both sides
  if (otherThread) {
    if (messageCloser) {
      try {
        await service.sendMessage({ text: '*Chat closed.*' }, thread)
      } catch (err) {
        console.error('Error sending close message to closer:', err)
      }
      try {
        await service.setStatus(thread, 'closed')
      } catch (err) {
        console.error('Error setting status for closer thread:', err)
      }
    }
    const otherService = getService(otherThread)
    try {
      await otherService.sendMessage(
        { text: '*The other user has closed the chat.*' },
        otherThread
      )
    } catch (err) {
      console.error('Error sending close message to other user:', err)
    }
    try {
      await otherService.setStatus(otherThread, 'closed')
    } catch (err) {
      console.error('Error setting status for other thread:', err)
    }
    try {
      await otherService.closeChat(otherThread)
    } catch (err) {
      console.error('Error closing other thread chat:', err)
    }
  } else {
    try {
      await service.sendMessage({ text: '*Search cancelled.*' }, thread)
    } catch (err) {
      console.error('Error sending search cancelled message:', err)
    }
    try {
      await service.setStatus(thread, 'closed')
    } catch (err) {
      console.error('Error setting status to closed:', err)
    }
  }
}

async function tryConnect(thread: string) {
  try {
    const service = getService(thread)
    const result = await database.tryConnect(thread)
    if (result !== null) {
      // mark chat as active on connect
      try {
        await service.sendMessage(
          {
            text: '*Connected!*\n*Send STOP to close the chat.*',
          },
          thread
        )
      } catch (err) {
        console.error('Error sending connected message to first user:', err)
      }
      try {
        await service.setStatus(thread, 'connected')
      } catch (err) {
        console.error('Error setting status connected for first user:', err)
      }

      const resultService = getService(result)
      try {
        await resultService.sendMessage(
          {
            text: '*Connected!*',
          },
          result
        )
      } catch (err) {
        console.error('Error sending connected message to second user:', err)
      }
      try {
        await resultService.setStatus(result, 'connected')
      } catch (err) {
        console.error('Error setting status connected for second user:', err)
      }
    } else {
      try {
        await service.setStatus(thread, 'connecting')
      } catch (err) {
        console.error('Error setting status connecting:', err)
      }
      try {
        await service.sendMessage(
          {
            text: '*Waiting for another user to connect...*\n*Send STOP to close the chat.*',
          },
          thread
        )
      } catch (err) {
        console.error('Error sending waiting message:', err)
      }
    }
  } catch (err) {
    console.error('Error trying to connect:', err)
  }
}

for (const service of services) {
  service.on('newThread', async (thread, userId) => {
    try {
      await database.newThread(thread, userId)
    } catch (err) {
      console.error('DB error creating new thread:', err)
    }
    await tryConnect(thread)
  })

  service.on('message', async (content, thread) => {
    try {
      // Handle STOP to close the chat
      if (content.text && content.text.trim() === 'STOP') {
        await closeChat(thread)
        return
      }
      // Handle DISABLE to turn off UwU mode if active
      if (content.text && content.text.trim() === 'DISABLE') {
        const wasActive = await database.isUwuModeActive(thread)
        if (wasActive) {
          await database.disableUwuModeForChat(thread)
          const otherThread = await database.getOtherThread(thread)
          const otherService = otherThread ? getService(otherThread) : null
          try {
            await service.sendMessage({ text: '*UwU mode disabled.*' }, thread)
          } catch (err) {
            console.error('Error notifying disabler:', err)
          }
          if (otherThread && otherService) {
            try {
              await otherService.sendMessage(
                { text: '*The other user has disabled UwU mode.*' },
                otherThread
              )
            } catch (err) {
              console.error('Error notifying other user of disable:', err)
            }
          }
        }
        return
      }
      const threadInfo = await database.getThread(thread)
      if (!threadInfo) {
        try {
          await service.sendMessage(
            {
              text: '*Thread not found in the database. Please start a new chat.*',
            },
            thread
          )
        } catch (err) {
          console.error('Error notifying user of missing thread:', err)
        }
        try {
          await service.setStatus(thread, 'closed')
        } catch (err) {
          console.error('Error setting closed status for missing thread:', err)
        }
        return
      }

      if (threadInfo.status === 'connected') {
        const otherThread = await database.getOtherThread(thread)
        if (otherThread === null) {
          // no other thread connected
          throw new Error('No other thread connected')
        }
        // forward message to the other person
        const otherService = getService(otherThread)
        try {
          const active = await database.isUwuModeActive(thread)
          const msg = active ? { text: uwuwify(content.text) } : content
          await otherService.sendMessage(msg, otherThread)
        } catch (err) {
          console.error('Error forwarding message to other thread:', err)
        }
        try {
          await database.touchChat(thread)
        } catch (err) {
          console.error('DB error touching chat (thread):', err)
        }
        try {
          await database.touchChat(otherThread)
        } catch (err) {
          console.error('DB error touching chat (otherThread):', err)
        }

        // Hidden trigger: mark uwu opt-in on trigger phrases
        if (/(uwu|owo|rawr|>w<)/i.test(content.text || '')) {
          const bothOpted = await database.markUwuOptIn(thread)
          if (bothOpted && !(await database.isUwuModeActive(thread))) {
            await database.enableUwuModeForChat(thread)
            const otherThread = await database.getOtherThread(thread)
            const otherService = otherThread ? getService(otherThread) : null
            try {
              await service.sendMessage(
                {
                  text: '*UwU mode enabled! Send DISABLE to disable.*',
                },
                thread
              )
            } catch (err) {
              console.error('Error notifying enabler:', err)
            }
            if (otherThread && otherService) {
              try {
                await otherService.sendMessage(
                  { text: '*UwU mode enabled! Send DISABLE to disable.*' },
                  otherThread
                )
              } catch (err) {
                console.error('Error notifying other user of enable:', err)
              }
            }
          }
        }

        return
      }
      if (threadInfo.status === 'connecting') {
        try {
          await service.sendMessage(
            {
              text: '*No one is connected to this chat. Please wait for another user to connect.*',
            },
            thread
          )
        } catch (err) {
          console.error('Error notifying user they are connecting:', err)
        }
        return
      }
      if (threadInfo.status === 'closed') {
        try {
          await service.sendMessage(
            {
              text: '*This chat is closed. Please start a new chat.*',
            },
            thread
          )
        } catch (err) {
          console.error('Error notifying user the chat is closed:', err)
        }
        return
      }
      throw new Error('Unknown status')
    } catch (error) {
      console.error(error)
      try {
        await service.sendMessage(
          {
            text: '*An error occurred while processing your message.*',
          },
          thread
        )
      } catch (err) {
        console.error('Error notifying user of processing error:', err)
      }
    }
  })

  service.on('closeThread', async (thread) => {
    try {
      await closeChat(thread, false)
    } catch (error) {
      console.error(error)
    }
  })
}
