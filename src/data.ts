import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase'
import type {
  Category,
  CategoryId,
  ChatMessage,
  Checklist,
  Contact,
  Conversation,
  FaqEntry,
  Inquiry,
  InquiryGroup,
  Notice,
} from './types'

const toMillis = (value: unknown) => {
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'number') return value
  if (typeof value === 'string') return new Date(value).getTime()
  return Date.now()
}

const requireDb = () => {
  if (!db) throw new Error('Firebase 환경변수가 설정되지 않았습니다.')
  return db
}

const load = async <T>(
  name: string,
  mapper: (snapshot: QueryDocumentSnapshot<DocumentData>) => T,
  ordered = true,
) => {
  const database = requireDb()
  const ref = collection(database, name)
  const snapshots = await getDocs(ordered ? query(ref, orderBy('order', 'asc')) : ref)
  return snapshots.docs.map(mapper)
}

export const loadCategories = () =>
  load<Category>('categories', (snapshot) => {
    const data = snapshot.data()
    return {
      id: String(data.id ?? snapshot.id) as CategoryId,
      label: String(data.label ?? ''),
      description: String(data.description ?? ''),
      phone: String(data.phone ?? ''),
      hours: String(data.hours ?? ''),
      order: Number(data.order ?? 0),
    }
  })

export const loadNotices = () =>
  load<Notice>('notices', (snapshot) => {
    const data = snapshot.data()
    return {
      id: String(data.id ?? snapshot.id),
      categoryId: String(data.categoryId ?? 'etc') as CategoryId,
      title: String(data.title ?? ''),
      url: String(data.url ?? ''),
      postedAt: toMillis(data.postedAt),
      order: Number(data.order ?? 999),
      viewCount: Number(data.viewCount ?? 0),
    }
  }, false)

export const loadFaqs = () =>
  load<FaqEntry>('faqEntries', (snapshot) => {
    const data = snapshot.data()
    return {
      id: String(data.id ?? snapshot.id),
      categoryId: String(data.categoryId ?? 'etc') as CategoryId,
      question: String(data.question ?? ''),
      answer: String(data.answer ?? ''),
      answerImageUrls: Array.isArray(data.answerImageUrls) ? data.answerImageUrls.map(String) : [],
      relatedNoticeIds: Array.isArray(data.relatedNoticeIds) ? data.relatedNoticeIds.map(String) : [],
      order: Number(data.order ?? 0),
      pinned: Boolean(data.pinned),
      showOnHome: Boolean(data.showOnHome),
      viewCount: Number(data.viewCount ?? 0),
      updatedAt: toMillis(data.updatedAt),
    }
  })

export const loadContacts = () =>
  load<Contact>('contacts', (snapshot) => {
    const data = snapshot.data()
    return {
      id: String(data.id ?? snapshot.id),
      team: String(data.team ?? ''),
      topic: String(data.topic ?? ''),
      ext: String(data.ext ?? ''),
      phone: String(data.phone ?? ''),
      group: String(data.group ?? '기타'),
      categories: Array.isArray(data.categories) ? data.categories.map(String) as CategoryId[] : [],
      priority: Number(data.priority ?? 2),
      order: Number(data.order ?? 999),
    }
  })

export const loadChecklists = () =>
  load<Checklist>('checklists', (snapshot) => {
    const data = snapshot.data()
    return {
      id: String(data.id ?? snapshot.id),
      categoryId: String(data.categoryId ?? 'etc') as CategoryId,
      order: Number(data.order ?? 0),
      items: Array.isArray(data.items) ? data.items : [],
    }
  })

export const loadInquiries = async () => {
  const database = requireDb()
  const snapshots = await getDocs(query(collection(database, 'inquiries'), orderBy('createdAt', 'desc')))
  return snapshots.docs.map((snapshot): Inquiry => {
    const data = snapshot.data()
    return {
      id: snapshot.id,
      source: data.source === 'phone' ? 'phone' : 'chat',
      categoryId: String(data.categoryId ?? 'etc') as CategoryId,
      keyword: String(data.keyword ?? ''),
      detail: String(data.detail ?? ''),
      status: data.status === 'answered' ? 'answered' : 'pending',
      createdAt: toMillis(data.createdAt),
      answeredAt: data.answeredAt ? toMillis(data.answeredAt) : undefined,
    }
  })
}

export const groupInquiries = (inquiries: Inquiry[], categoryId: CategoryId | 'all') => {
  const groups = new Map<string, InquiryGroup>()
  inquiries
    .filter((item) => categoryId === 'all' || item.categoryId === categoryId)
    .forEach((item) => {
      const key = `${item.categoryId}:${item.keyword}`
      const group = groups.get(key) ?? {
        key,
        categoryId: item.categoryId,
        keyword: item.keyword,
        total: 0,
        chat: 0,
        phone: 0,
        pending: 0,
        status: 'answered' as const,
        inquiryIds: [],
      }
      group.total += 1
      group[item.source] += 1
      if (item.status === 'pending') group.pending += 1
      group.status = group.pending > 0 ? 'pending' : 'answered'
      group.inquiryIds.push(item.id)
      groups.set(key, group)
    })
  return [...groups.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
    return b.total - a.total
  })
}

export const createPhoneInquiry = async (categoryId: CategoryId, keyword: string, detail: string) =>
  addDoc(collection(requireDb(), 'inquiries'), {
    source: 'phone',
    categoryId,
    keyword,
    detail,
    status: 'pending',
    createdAt: serverTimestamp(),
  })

export const uploadAnswerImages = async (faqId: string, files: File[]) => {
  if (!storage || files.length === 0) return []
  const activeStorage = storage
  const uploads = files.map(async (file) => {
    const path = `faq-answers/${faqId}/${Date.now()}-${file.name}`
    const target = ref(activeStorage, path)
    await uploadBytes(target, file)
    return getDownloadURL(target)
  })
  return Promise.all(uploads)
}

export const saveDocument = async <T extends { id: string }>(name: string, item: T) => {
  await setDoc(doc(requireDb(), name, item.id), { ...item, updatedAt: serverTimestamp() }, { merge: true })
}

export const removeDocument = async (name: string, id: string) => {
  await deleteDoc(doc(requireDb(), name, id))
}

// 체크리스트 저장(신규 생성·수정 겸용). setDoc+merge라 문서가 없으면 새로 만든다.
export const saveChecklist = async (item: Checklist) => {
  await setDoc(
    doc(requireDb(), 'checklists', item.id),
    {
      id: item.id,
      items: item.items,
      order: item.order,
      categoryId: item.categoryId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

// ── 실시간 채팅 상담 ──

const mapConversation = (snapshot: QueryDocumentSnapshot<DocumentData>): Conversation => {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    studentNumber: String(data.studentNumber ?? ''),
    categoryId: String(data.categoryId ?? 'etc') as CategoryId,
    status: data.status === 'answered' ? 'answered' : 'open',
    lastMessage: String(data.lastMessage ?? ''),
    lastMessageAt: toMillis(data.lastMessageAt),
    createdAt: toMillis(data.createdAt),
    unreadForAdmin: Boolean(data.unreadForAdmin),
    unreadForStudent: Boolean(data.unreadForStudent),
    needsHuman: Boolean(data.needsHuman),
    studentMessageCount: Number(data.studentMessageCount ?? 0),
  }
}

// 대화 목록 실시간 구독(최근 메시지 순). 해제 함수를 반환한다.
// needsHuman == true(상담사 연결 요청) 대화만 구독한다 — 보안 규칙과 일치시켜야 하며,
// AI 상담 대화는 DB에서 읽어오지 않는다. (복합 인덱스: needsHuman ASC + lastMessageAt DESC)
export const subscribeConversations = (onChange: (conversations: Conversation[]) => void) => {
  const database = requireDb()
  const ref = query(
    collection(database, 'conversations'),
    where('needsHuman', '==', true),
    orderBy('lastMessageAt', 'desc'),
  )
  return onSnapshot(ref, (snapshot) => onChange(snapshot.docs.map(mapConversation)))
}

// 특정 대화의 메시지 실시간 구독.
export const subscribeConversationMessages = (
  conversationId: string,
  onChange: (messages: ChatMessage[]) => void,
) => {
  const database = requireDb()
  const messagesRef = collection(doc(database, 'conversations', conversationId), 'messages')
  // AI 자동응답(from == 'ai')은 상담사에게 노출하지 않는다 — 보안 규칙과 일치시킨 서버 측 필터.
  // '!=' 쿼리는 from 기준으로 먼저 정렬되므로 클라이언트에서 시간순으로 다시 정렬한다.
  // (복합 인덱스: from ASC + createdAt ASC)
  const messagesQuery = query(messagesRef, where('from', '!=', 'ai'), orderBy('from'), orderBy('createdAt', 'asc'))
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs
      .map((docSnapshot): ChatMessage => {
        const data = docSnapshot.data()
        return {
          id: docSnapshot.id,
          from: data.from === 'admin' ? 'admin' : data.from === 'bot' ? 'bot' : 'student',
          text: String(data.text ?? ''),
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.map(String) : undefined,
          createdAt: toMillis(data.createdAt),
        }
      })
      .sort((a, b) => a.createdAt - b.createdAt)
    onChange(messages)
  })
}

// 관리자 답장 전송 + 대화 메타 갱신(학생에게 미확인 표시).
export const sendAdminMessage = async (conversationId: string, text: string) => {
  const database = requireDb()
  const conversationRef = doc(database, 'conversations', conversationId)
  await addDoc(collection(conversationRef, 'messages'), {
    from: 'admin',
    text,
    createdAt: serverTimestamp(),
  })
  await updateDoc(conversationRef, {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    status: 'answered',
    unreadForAdmin: false,
    unreadForStudent: true,
  })
}

// 관리자가 대화를 열어볼 때 미확인 표시 해제.
export const markConversationReadByAdmin = async (conversationId: string) => {
  await setDoc(
    doc(requireDb(), 'conversations', conversationId),
    { unreadForAdmin: false },
    { merge: true },
  )
}
