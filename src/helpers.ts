import Uwuifier from 'uwuifier'
import {
  T as SimplexTypes,
  ChatEvent,
  CC as SimplexCommands,
  ChatResponse,
} from '@simplex-chat/types'
import type { ChatClient } from 'simplex-chat'

export class TypedEmitter<T extends Record<string, (...args: any[]) => void>> {
  private listeners: Map<keyof T, T[keyof T][]> = new Map()

  on<K extends keyof T>(event: K, listener: T[K]) {
    let arr = this.listeners.get(event) as T[K][] | undefined
    if (!arr) {
      arr = []
      this.listeners.set(event, arr as Array<T[keyof T]>)
    }
    arr.push(listener)
  }

  off<K extends keyof T>(event: K, listener: T[K]) {
    const arr = this.listeners.get(event) as T[K][] | undefined
    if (!arr) return
    const next = arr.filter((l) => l !== listener) as T[K][]
    if (next.length) this.listeners.set(event, next as Array<T[keyof T]>)
    else this.listeners.delete(event)
  }

  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>) {
    const arr = this.listeners.get(event) as T[K][] | undefined
    arr?.forEach((l) => l(...args))
  }
}

const uwuifier = new Uwuifier({
  spaces: {
    faces: 0.15,
    actions: 0.04,
    stutters: 0.3,
  },
  words: 1,
  exclamations: 1,
})
// the defaults are bad
// also, underscores for proper slack and simplex italics
uwuifier.actions = [
  '_blushes_',
  '_blushes_',
  '_blushes_',
  '_giggles_',
  '_giggles softly_',
  '_tail swishes_',
  '_wags tail excitedly_',
  '_whispers to self_',
  '_looks at you_',
  '_boops your nose_',
]
export function uwuwify(str: string) {
  let text = uwuifier.uwuifySentence(' ' + str.trim() + ' ').trim()
  if (Math.random() < 0.4)
    text +=
      ' ' +
      uwuifier.actions[Math.floor(Math.random() * uwuifier.actions.length)]
  if (Math.random() < 0.7)
    text +=
      ' ' + uwuifier.faces[Math.floor(Math.random() * uwuifier.faces.length)]
  return text
}

/**
 * ChatClient.apiCreateLink except with an incognito parameter
 */
export async function apiCreateLink(
  chat: ChatClient,
  userId: number,
  incognito = false
): Promise<string> {
  const r = await chat.sendChatCmd(
    SimplexCommands.APIAddContact.cmdString({ userId, incognito })
  )
  if (r.type === 'invitation') {
    const link = r.connLinkInvitation
    return link.connShortLink || link.connFullLink
  }
  console.error(r)
  throw new Error('error creating link')
}

interface CRContactInfo {
  type: 'contactInfo'
  user: SimplexTypes.User
  contact: SimplexTypes.Contact
  connectionStats: {
    rcvServers?: string[]
    sndServers?: string[]
  }
  customUserProfile?: SimplexTypes.Profile
}

export async function apiContactInfo(
  chat: ChatClient,
  contactId: number
): Promise<CRContactInfo> {
  const r = (await chat.sendChatCmd(`/_info @${contactId}`)) as
    | ChatResponse
    | CRContactInfo
  if (r.type === 'contactInfo') return r
  console.error(r)
  throw new Error('error fetching contact info')
}
