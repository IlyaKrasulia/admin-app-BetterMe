import { describe, it, expect, vi, beforeEach } from 'vitest'
import { quizApi } from '@api/quiz.api'
import { apiClient } from '@api/axios'

vi.mock('@api/axios', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)

beforeEach(() => {
  vi.clearAllMocks()
})

const currentNode = {
  id: 'n1',
  type: 'question' as const,
  attributeKey: 'goal',
  title: "What's your main goal?",
  description: null,
  mediaUrl: null,
  options: [],
}

describe('quizApi', () => {
  it('startSession calls POST /api/quiz/sessions', async () => {
    const response = {
      sessionId: 'sess1',
      flowId: 'f1',
      currentNode,
      progress: { answeredCount: 0 },
    }
    mockPost.mockResolvedValueOnce({ data: response })
    const result = await quizApi.startSession({ flowId: 'f1' })
    expect(mockPost).toHaveBeenCalledWith('/api/quiz/sessions', { flowId: 'f1' })
    expect(result.sessionId).toBe('sess1')
  })

  it('submitAnswer calls POST /api/quiz/sessions/{sessionId}/answers', async () => {
    const response = {
      sessionId: 'sess1',
      currentNode,
      progress: { answeredCount: 1 },
    }
    mockPost.mockResolvedValueOnce({ data: response })
    const result = await quizApi.submitAnswer('sess1', {
      nodeId: 'n1',
      value: 'weight_loss',
    })
    expect(mockPost).toHaveBeenCalledWith('/api/quiz/sessions/sess1/answers', {
      nodeId: 'n1',
      value: 'weight_loss',
    })
    expect(result.progress.answeredCount).toBe(1)
  })

  it('getSession calls GET /api/quiz/sessions/{sessionId}', async () => {
    const response = {
      sessionId: 'sess1',
      flowId: 'f1',
      status: 'in_progress' as const,
      currentNode,
      answers: [],
      offers: null,
      progress: { answeredCount: 0 },
    }
    mockGet.mockResolvedValueOnce({ data: response })
    const result = await quizApi.getSession('sess1')
    expect(mockGet).toHaveBeenCalledWith('/api/quiz/sessions/sess1')
    expect(result.status).toBe('in_progress')
  })

  it('goBack calls POST /api/quiz/sessions/{sessionId}/back', async () => {
    const response = {
      sessionId: 'sess1',
      currentNode,
      progress: { answeredCount: 0 },
    }
    mockPost.mockResolvedValueOnce({ data: response })
    const result = await quizApi.goBack('sess1')
    expect(mockPost).toHaveBeenCalledWith('/api/quiz/sessions/sess1/back')
    expect(result.progress.answeredCount).toBe(0)
  })

  it('recordConversion calls POST /api/quiz/sessions/{sessionId}/convert', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Conversion recorded.' } })
    const result = await quizApi.recordConversion('sess1', { offerId: 'o1' })
    expect(mockPost).toHaveBeenCalledWith('/api/quiz/sessions/sess1/convert', {
      offerId: 'o1',
    })
    expect(result.message).toBe('Conversion recorded.')
  })
})
