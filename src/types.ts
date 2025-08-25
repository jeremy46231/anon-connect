import type { Profile, MsgContent } from 'simplex-chat/src/command'
import type {
  CRChatCmdError,
  User,
  Contact,
  ChatError,
} from 'simplex-chat/src/response'

export type connectPlanResponse =
  | CRChatCmdError
  | {
      type: 'connectionPlan'
      user: User
      connLink: {
        connFullLink: string
        connShortLink?: string
      }
      connectionPlan:
        | {
            type: 'invitationLink'
            invitationLinkPlan:
              | {
                  type: 'ok'
                  contactSLinkData_: {
                    profile: Profile
                    message: MsgContent
                    business: boolean
                  }
                }
              | {
                  type: 'ownLink'
                }
              | {
                  type: 'connecting'
                  contact_: Contact
                }
              | {
                  type: 'known'
                  contact: Contact
                }
          }
        | {
            type: 'contactAddress'
            contactAddressPlan:
              | {
                  type: 'ok'
                  contactSLinkData_: {
                    profile: Profile
                    message: MsgContent
                    business: boolean
                  }
                }
              | {
                  type: 'ownLink'
                }
              | {
                  type: 'connectingConfirmReconnect'
                }
              | {
                  type: 'connectingProhibit'
                  contact: Contact
                }
              | {
                  type: 'known'
                  contact: Contact
                }
              | {
                  type: 'contactViaAddress'
                  contact: Contact
                }
          }
        | {
            type: 'groupLink'
            groupLinkPlan: unknown // i can't be bothered
          }
        | {
            type: 'error'
            error: ChatError
          }
    }
