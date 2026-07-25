import { auth } from './firebase'
import type { Category, CategoryId, Inquiry } from './types'

const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE ?? '').replace(/\/+$/, '')

export const hasAiApiBase = Boolean(AI_API_BASE)

export type InquiryTopicCandidate = {
  topic: string
  topicKey: string
  categoryId: CategoryId
}

export type InquiryClassificationResult = {
  id: string
  categoryId?: CategoryId
  topic: string
  topicKey: string
  confidence?: number
}

type ClassifyInquiryTopicsInput = {
  categories: Category[]
  existingTopics: InquiryTopicCandidate[]
  inquiries: Inquiry[]
}

const getAdminToken = async () => {
  const user = auth?.currentUser
  if (!user) throw new Error('관리자 로그인이 필요합니다.')
  return user.getIdToken()
}

export const classifyInquiryTopics = async ({
  categories,
  existingTopics,
  inquiries,
}: ClassifyInquiryTopicsInput) => {
  if (!AI_API_BASE) throw new Error('VITE_AI_API_BASE가 설정되지 않았습니다.')

  const token = await getAdminToken()
  const response = await fetch(`${AI_API_BASE}/api/admin/classify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        description: category.description,
      })),
      existingTopics,
      inquiries: inquiries.map((inquiry) => ({
        id: inquiry.id,
        categoryId: inquiry.categoryId,
        keyword: inquiry.keyword,
        detail: inquiry.detail,
        source: inquiry.source,
      })),
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `문의 분류 요청에 실패했습니다. (${response.status})`)
  }

  const data = (await response.json()) as { results?: InquiryClassificationResult[] }
  return Array.isArray(data.results) ? data.results : []
}
