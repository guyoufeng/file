export interface AiToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
}

export interface AiQueryResult {
  answer: string
  sources: Array<{
    type: 'device' | 'rack' | 'room' | 'alert' | 'audit'
    id: string
    name: string
  }>
  toolCalls: AiToolCall[]
  queriedAt: string
}

export interface AiMessageInput {
  role: 'system' | 'user' | 'assistant'
  content: string
}
