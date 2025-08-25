import { ChatClient } from 'simplex-chat'
import { SimpleXBot } from './simplex'

const simplex = await ChatClient.create('ws://localhost:5225')
const bot = new SimpleXBot(simplex)
bot.runBot()
