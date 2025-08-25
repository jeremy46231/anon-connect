import { ChatClient } from 'simplex-chat'
import Slack from '@slack/bolt'
import { SimpleXBot } from './simplex'

const simplex = await ChatClient.create('ws://localhost:5225')
const bot = new SimpleXBot(simplex)
bot.runBot()

const slack = new Slack.App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
})
