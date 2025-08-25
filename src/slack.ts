import type Slack from '@slack/bolt'
import type { types as SlackTypes, webApi as SlackAPI } from '@slack/bolt'

class SlackBot {
  constructor(private app: Slack.App) {}
}
