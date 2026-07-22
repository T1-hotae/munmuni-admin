export type CategoryId = 'transfer' | 'course' | 'leave' | 'etc'

export type Category = {
  id: CategoryId
  label: string
  description: string
  phone: string
  hours: string
  order: number
}

export type KeywordPreset = {
  id: string
  categoryId: CategoryId
  label: string
  order: number
}

export type Inquiry = {
  id: string
  source: 'chat' | 'phone'
  categoryId: CategoryId
  keyword: string
  detail: string
  status: 'pending' | 'answered'
  createdAt: number
  answeredAt?: number
}

export type Notice = {
  id: string
  categoryId: CategoryId
  title: string
  url: string
  postedAt: number
  order: number
  viewCount: number
}

export type FaqEntry = {
  id: string
  categoryId: CategoryId
  question: string
  answer: string
  answerImageUrls: string[]
  relatedNoticeIds: string[]
  order: number
  pinned: boolean
  viewCount: number
  updatedAt: number
}

export type ChatMessage = {
  id: string
  from: 'student' | 'admin' | 'bot' | 'ai'
  text: string
  imageUrls?: string[]
  createdAt: number
}

export type Conversation = {
  id: string
  studentId: string
  studentName: string
  studentNumber: string
  categoryId: CategoryId
  status: 'open' | 'answered'
  lastMessage: string
  lastMessageAt: number
  createdAt: number
  unreadForAdmin: boolean
  unreadForStudent: boolean
  needsHuman: boolean
  studentMessageCount: number
}

export type ChecklistItem = {
  id: string
  label: string
  content: string
  order: number
}

export type Checklist = {
  id: string
  categoryId: CategoryId
  order: number
  items: ChecklistItem[]
}

export type InquiryGroup = {
  key: string
  categoryId: CategoryId
  keyword: string
  total: number
  chat: number
  phone: number
  pending: number
  status: 'pending' | 'answered'
  inquiryIds: string[]
}
