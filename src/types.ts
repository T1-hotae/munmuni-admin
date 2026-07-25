// 카테고리는 관리자 앱에서 자유롭게 추가/수정한다. 특정 문자열로 고정하지 않는다.
// (예약어 'etc'는 미분류/기타 catch-all 용도로만 관례적으로 사용)
export type CategoryId = string

export type Category = {
  id: CategoryId
  label: string
  description: string
  phone: string
  hours: string
  order: number
}

export type Inquiry = {
  id: string
  source: 'chat' | 'phone'
  categoryId: CategoryId
  keyword: string
  detail: string
  topic?: string
  topicKey?: string
  classifiedAt?: number
  classifiedBy?: 'ai' | 'manual'
  status: 'pending' | 'answered'
  answeredBy?: 'ai' | 'admin'
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
  // 홈 '지금 많이 묻는 질문' 섹션 노출 여부(학생 웹).
  showOnHome: boolean
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

// 학내 부서 연락처(구내전화 안내 기반). 부서·업무·내선만 관리한다(개인 실명 제외).
export type Contact = {
  id: string
  team: string
  topic: string
  ext: string
  phone: string
  group: string
  categories: CategoryId[]
  priority: number
  order: number
}

export type InquiryGroup = {
  key: string
  categoryId: CategoryId
  keyword: string
  topic?: string
  topicKey?: string
  total: number
  chat: number
  phone: number
  pending: number
  aiAnswered: number
  adminAnswered: number
  status: 'pending' | 'answered'
  inquiryIds: string[]
}
