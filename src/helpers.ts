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
