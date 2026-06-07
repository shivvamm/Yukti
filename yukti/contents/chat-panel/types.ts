export type Role = "user" | "assistant" | "system"

export interface ChatSource {
  url: string
  timestamp: number
  snippet: string
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  sources?: ChatSource[]
  isError?: boolean
}
