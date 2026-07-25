import { BarChart3, BookUser, Edit3, FileQuestion, ListChecks, LockKeyhole, LogOut, MessageSquare, Newspaper, PhoneCall, RefreshCw, Save, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  createPhoneInquiry,
  groupInquiries,
  loadCategories,
  loadChecklists,
  loadContacts,
  loadFaqs,
  loadInquiries,
  loadNotices,
  markConversationReadByAdmin,
  removeDocument,
  saveChecklist,
  saveDocument,
  sendAdminMessage,
  subscribeConversationMessages,
  subscribeConversations,
  updateInquiryTopics,
  uploadAnswerImages,
} from './data'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ADMIN_LOGIN_EMAIL, auth, hasFirebaseConfig } from './firebase'
import { classifyInquiryTopics, hasAiApiBase, type InquiryTopicCandidate } from './ai'
import mascotUrl from './assets/munmuni-mascot.png'
import type { Category, CategoryId, ChatMessage, Checklist, Contact, Conversation, FaqEntry, Inquiry, Notice } from './types'

type Store = {
  categories: Category[]
  notices: Notice[]
  faqs: FaqEntry[]
  checklists: Checklist[]
  contacts: Contact[]
  inquiries: Inquiry[]
}

const emptyStore: Store = {
  categories: [],
  notices: [],
  faqs: [],
  checklists: [],
  contacts: [],
  inquiries: [],
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}`

// 내선번호 → 걸 수 있는 전체 번호. 3XXX → 031-280-3XXX, 7XXX → 031-899-7XXX, 국번 포함은 031- 보정.
const extToPhone = (ext: string) => {
  const s = ext.trim()
  if (!s) return ''
  if (s.startsWith('0')) return s
  if (s.includes('-')) return `031-${s}`
  if (/^3\d{3}$/.test(s)) return `031-280-${s}`
  if (/^7\d{3}$/.test(s)) return `031-899-${s}`
  return s
}

// 같은 목록에서 다음 정렬 순서를 계산한다. 순서를 비워두면 맨 뒤에 붙도록 하는 용도.
const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.order), 0) + 1

// 채팅 목록용 시각 표기. 오늘이면 시:분, 그 전이면 월/일.
const formatChatTime = (millis: number) => {
  if (!millis) return ''
  const date = new Date(millis)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

// 화면 우하단 토스트. 저장/삭제 결과를 관리자에게 짧게 알려준다.
type Toast = { id: number; text: string; kind: 'success' | 'error' }
let toastSeq = 0
let toastListeners: Array<(toast: Toast) => void> = []
const notify = (text: string, kind: Toast['kind'] = 'success') => {
  const toast = { id: (toastSeq += 1), text, kind }
  toastListeners.forEach((listener) => listener(toast))
}

function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast])
      setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== toast.id)), 2600)
    }
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter((item) => item !== listener)
    }
  }, [])
  if (toasts.length === 0) return null
  return (
    <div className="toastHost" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>{toast.text}</div>
      ))}
    </div>
  )
}

function useAuthState() {
  const [authenticated, setAuthenticated] = useState(false)
  const [ready, setReady] = useState(!auth)

  useEffect(() => {
    if (!auth) {
      setReady(true)
      return
    }
    return onAuthStateChanged(auth, (user) => {
      setAuthenticated(Boolean(user))
      setReady(true)
    })
  }, [])

  const logout = () => {
    if (auth) void signOut(auth)
    setAuthenticated(false)
  }
  return { authenticated, ready, logout }
}

function useStore(authenticated: boolean) {
  const [store, setStore] = useState<Store>(emptyStore)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [error, setError] = useState('')
  const refresh = async () => {
    if (!authenticated) return
    setLoading(true)
    setError('')
    try {
      const [categories, notices, faqs, checklists, contacts, inquiries] = await Promise.all([
        loadCategories(),
        loadNotices(),
        loadFaqs(),
        loadChecklists(),
        loadContacts(),
        loadInquiries(),
      ])
      setStore({ categories, notices, faqs, checklists, contacts, inquiries })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firebase 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
      setLoadedOnce(true)
    }
  }
  useEffect(() => {
    void refresh()
  }, [authenticated])
  return { store, loading, loadedOnce, error, refresh }
}

function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!auth) {
      setError('Firebase 환경변수를 먼저 설정하세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, ADMIN_LOGIN_EMAIL, password)
      // 성공 시 onAuthStateChanged가 화면을 전환합니다.
    } catch {
      setError('비밀번호를 확인하세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <section className="loginPanel" aria-label="문무니 관리자 로그인">
        <div className="loginBrand">
          <img className="loginMascot" src={mascotUrl} alt="문무니 마스코트" />
          <span className="loginSparkle" aria-hidden="true">✦</span>
          <span className="loginSparkle" aria-hidden="true">✦</span>
          <span>관리자 콘솔</span>
          <h1>문무니</h1>
          <p>학생 문의와 안내 데이터를 관리하는 전용 데스크톱 앱입니다.</p>
        </div>
        <form onSubmit={onSubmit} className="loginForm">
          <div className="loginFormHeader">
            <ShieldCheck size={22} />
            <div>
              <h2>로그인</h2>
              <p>관리자 계정 비밀번호</p>
            </div>
          </div>
          <label className="passwordField">
            <span>비밀번호</span>
            <div>
              <LockKeyhole size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="관리자 비밀번호"
                autoFocus
              />
            </div>
          </label>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? '로그인 중…' : '문무니 시작하기'}
          </button>
          {!hasFirebaseConfig && <small>Firebase 환경변수가 설정되지 않았습니다.</small>}
          {error && <small className="error">{error}</small>}
        </form>
      </section>
    </main>
  )
}

function Shell({
  children,
  loadError,
  syncing,
  onRefresh,
  onLogout,
}: {
  children: React.ReactNode
  loadError: string
  syncing: boolean
  onRefresh: () => Promise<void>
  onLogout: () => void
}) {
  const handleRefresh = async () => {
    try {
      await onRefresh()
    } catch {
      notify('새로고침에 실패했습니다.', 'error')
    }
  }

  return (
    <div className="app">
      {syncing && <div className="syncBar">동기화 중…</div>}
      <ToastHost />
      <aside className="sidebar">
        <div className="sidebarBrand">
          <span className="brandAvatar"><img src={mascotUrl} alt="" /></span>
          <strong>문무니</strong>
          <span className="brandSub">관리자 콘솔</span>
        </div>
        <nav>
          <NavLink to="/" end><BarChart3 size={18} />통계</NavLink>
          <NavLink to="/chat"><MessageSquare size={18} />채팅 상담</NavLink>
          <NavLink to="/log-call"><PhoneCall size={18} />전화 기록</NavLink>
          <NavLink to="/edit/categories"><Edit3 size={18} />카테고리</NavLink>
          <NavLink to="/edit/faqs"><FileQuestion size={18} />FAQ</NavLink>
          <NavLink to="/edit/notices"><Newspaper size={18} />원문 공지</NavLink>
          <NavLink to="/edit/checklists"><ListChecks size={18} />체크리스트</NavLink>
          <NavLink to="/edit/contacts"><BookUser size={18} />전화번호부</NavLink>
        </nav>
        <div className="sidebarActions">
          <button type="button" onClick={() => void handleRefresh()} disabled={syncing}>
            <RefreshCw size={18} />{syncing ? '새로고침 중' : '새로고침'}
          </button>
          <button type="button" onClick={onLogout}>
            <LogOut size={18} />로그아웃
          </button>
        </div>
      </aside>
      <main className="content">
        {loadError && <div className="notice">{loadError}</div>}
        {!hasFirebaseConfig && (
          <div className="notice">
            Firebase 연결값이 없습니다. `.env`에 VITE_FIREBASE_* 값을 넣은 뒤 앱을 다시 실행하세요.
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

function Stats({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const [classifying, setClassifying] = useState(false)
  const totalInquiries = store.inquiries.length
  const chatCount = store.inquiries.filter((item) => item.source === 'chat').length
  const phoneCount = store.inquiries.filter((item) => item.source === 'phone').length
  const aiAnsweredCount = store.inquiries.filter((item) => item.answeredBy === 'ai').length
  const adminAnsweredCount = store.inquiries.filter((item) => item.status === 'answered' && item.answeredBy !== 'ai').length
  const pendingCount = store.inquiries.filter((item) => item.status === 'pending' && item.answeredBy !== 'ai').length
  const topKeywords = useMemo(() => groupInquiries(store.inquiries, 'all').slice(0, 8), [store.inquiries])
  const topFaqs = useMemo(() => [...store.faqs].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5), [store.faqs])
  const topNotices = useMemo(
    () => [...store.notices].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5),
    [store.notices],
  )
  const categoryStats = store.categories.map((category) => {
    const count = store.inquiries.filter((item) => item.categoryId === category.id).length
    return { category, count, percent: totalInquiries ? Math.round((count / totalInquiries) * 100) : 0 }
  })
  const unclassifiedInquiries = useMemo(
    () => store.inquiries.filter((item) => !item.topicKey?.trim()).slice(0, 50),
    [store.inquiries],
  )
  const existingTopics = useMemo(() => {
    const topics = new Map<string, InquiryTopicCandidate>()
    store.inquiries.forEach((item) => {
      if (!item.topic?.trim() || !item.topicKey?.trim()) return
      const key = `${item.categoryId}:${item.topicKey}`
      if (!topics.has(key)) {
        topics.set(key, {
          topic: item.topic,
          topicKey: item.topicKey,
          categoryId: item.categoryId,
        })
      }
    })
    return [...topics.values()].slice(0, 200)
  }, [store.inquiries])
  const categoryLabel = (id: CategoryId) => store.categories.find((category) => category.id === id)?.label ?? id

  const classifyTopics = async () => {
    if (unclassifiedInquiries.length === 0) return
    if (!hasAiApiBase) {
      notify('VITE_AI_API_BASE를 설정한 뒤 문의 분류를 실행할 수 있습니다.', 'error')
      return
    }

    setClassifying(true)
    try {
      const results = await classifyInquiryTopics({
        categories: store.categories,
        existingTopics,
        inquiries: unclassifiedInquiries,
      })
      const validResults = results.filter((item) => item.id && item.topic?.trim() && item.topicKey?.trim())
      if (validResults.length === 0) {
        notify('저장할 분류 결과가 없습니다.', 'error')
        return
      }
      await updateInquiryTopics(validResults)
      notify(`문의 ${validResults.length}건을 주제별로 분류했습니다.`)
      await refresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : '문의 분류에 실패했습니다.', 'error')
    } finally {
      setClassifying(false)
    }
  }

  return (
    <>
      <header className="pageHeader">
        <div>
          <span>통계</span>
          <h1>운영 통계</h1>
        </div>
        <div className="headerActions">
          <button
            type="button"
            disabled={classifying || unclassifiedInquiries.length === 0}
            onClick={() => void classifyTopics()}
            title={hasAiApiBase ? undefined : 'VITE_AI_API_BASE 설정이 필요합니다.'}
          >
            <Sparkles size={18} />
            {classifying ? '분류 중…' : `미분류 ${unclassifiedInquiries.length}건 분류`}
          </button>
          <Link className="primary" to="/log-call">전화 문의 기록</Link>
        </div>
      </header>
      <section className="stats">
        <article><strong>{totalInquiries}</strong><span>전체 문의</span></article>
        <article><strong>{chatCount}</strong><span>채팅 문의</span></article>
        <article><strong>{phoneCount}</strong><span>전화 문의</span></article>
        <article><strong>{aiAnsweredCount}</strong><span>AI 답변</span></article>
        <article><strong>{adminAnsweredCount}</strong><span>상담사 답변</span></article>
        <article><strong>{pendingCount}</strong><span>미답변</span></article>
        <article><strong>{store.faqs.length}</strong><span>게시 FAQ</span></article>
        <article><strong>{store.notices.length}</strong><span>등록 공지</span></article>
      </section>

      <div className="panel">
        <h2>카테고리별 문의 분포</h2>
        {categoryStats.map(({ category, count, percent }) => (
          <div key={category.id} className="statBarRow">
            <span>{category.label}</span>
            <div className="statBar"><div className="statBarFill" style={{ width: `${percent}%` }} /></div>
            <span>{count}건 ({percent}%)</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panelHeader">
          <div>
            <h2>많이 묻는 주제</h2>
            <p className="editorHint">
              AI 분류가 끝난 문의는 주제 기준으로 묶고, 아직 분류 전인 문의는 기존 키워드 기준으로 집계합니다.
            </p>
          </div>
          <mark className={unclassifiedInquiries.length > 0 ? 'pending' : 'answered'}>
            미분류 {unclassifiedInquiries.length}건
          </mark>
        </div>
        {topKeywords.length === 0 ? (
          <p className="editorHint">아직 집계된 문의가 없습니다.</p>
        ) : (
          <table>
            <thead><tr><th>주제</th><th>카테고리</th><th>전체</th><th>채팅</th><th>전화</th><th>AI 답변</th><th>상담사 답변</th><th>미답변</th></tr></thead>
            <tbody>
              {topKeywords.map((group) => (
                <tr key={group.key}>
                  <td>{group.keyword}</td>
                  <td>{categoryLabel(group.categoryId)}</td>
                  <td>{group.total}</td>
                  <td>{group.chat}</td>
                  <td>{group.phone}</td>
                  <td>{group.aiAnswered}</td>
                  <td>{group.adminAnswered}</td>
                  <td>{group.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="twoColumnStats">
        <div className="panel">
          <h2>FAQ 조회수 TOP 5</h2>
          {topFaqs.length === 0 ? (
            <p className="editorHint">아직 등록된 FAQ가 없습니다.</p>
          ) : (
            <ol className="rankList">
              {topFaqs.map((faq) => (
                <li key={faq.id}><span>{faq.question}</span><strong>{faq.viewCount}</strong></li>
              ))}
            </ol>
          )}
        </div>
        <div className="panel">
          <h2>공지 조회수 TOP 5</h2>
          {topNotices.length === 0 ? (
            <p className="editorHint">아직 등록된 공지가 없습니다.</p>
          ) : (
            <ol className="rankList">
              {topNotices.map((notice) => (
                <li key={notice.id}><span>{notice.title}</span><strong>{notice.viewCount}</strong></li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  )
}

function LogCall({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const [categoryId, setCategoryId] = useState<CategoryId>(store.categories[0]?.id ?? '')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const label = (id: CategoryId) => store.categories.find((item) => item.id === id)?.label ?? id
  const phoneMemos = store.inquiries.filter((item) => item.source === 'phone').slice(0, 20)

  const save = async () => {
    if (!memo.trim()) return
    setSaving(true)
    try {
      await createPhoneInquiry(categoryId || store.categories[0]?.id || 'etc', memo.trim(), '')
      notify('전화 메모를 저장했습니다.')
      setMemo('')
      await refresh()
    } catch {
      notify('저장에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <header className="pageHeader"><div><span>전화 상담</span><h1>전화 문의 메모</h1></div></header>
      <div className="panel">
        <p className="editorHint">전화로 받은 문의를 간단히 메모하세요. 통계의 전화 문의 수·카테고리 분포에 집계됩니다.</p>
        <FormRow>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {store.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </FormRow>
        <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={4} placeholder="문의 내용 메모 (예: 전과 신청 기간 문의)" />
        <button className="primary" disabled={saving} onClick={() => void save()}>{saving ? '저장 중…' : '메모 저장'}</button>
      </div>
      <div className="panel">
        <h2>최근 전화 메모</h2>
        {phoneMemos.length === 0 ? (
          <p className="editorHint">아직 기록된 전화 메모가 없습니다.</p>
        ) : (
          <div className="list">
            {phoneMemos.map((item) => (
              <div key={item.id}>
                <span>[{label(item.categoryId)}] {item.keyword}</span>
                <small>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ChatConsole({ store }: { store: Store }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reply, setReply] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasFirebaseConfig) return
    return subscribeConversations(setConversations)
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    void markConversationReadByAdmin(selectedId)
    return subscribeConversationMessages(selectedId, setMessages)
  }, [selectedId])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages])

  const label = (id: CategoryId) => store.categories.find((item) => item.id === id)?.label ?? id
  const selected = conversations.find((item) => item.id === selectedId)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const text = reply.trim()
    if (!text || !selectedId) return
    setReply('')
    await sendAdminMessage(selectedId, text)
  }

  const who = (from: ChatMessage['from']) =>
    from === 'admin' ? '관리자' : from === 'ai' ? 'AI' : from === 'bot' ? '자동응답' : '학생'

  // AI 상담(needsHuman=false)은 상담사에게 노출하지 않는다.
  // 상담사 연결을 요청한 대화(관리자 문의·에스컬레이션)만, 그리고 학생이 실제로 메시지를 보낸 것만 표시한다.
  const orderedConversations = conversations
    .filter((conversation) => conversation.needsHuman && conversation.studentMessageCount > 0)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)

  return (
    <section>
      <header className="pageHeader"><div><span>실시간 상담</span><h1>채팅 상담</h1></div></header>
      <div className="chatConsole">
        <aside className="chatList">
          {orderedConversations.length === 0 && <p className="chatEmpty">진행 중인 대화가 없습니다.</p>}
          {orderedConversations.map((conversation) => (
            <button
              key={conversation.id}
              className={selectedId === conversation.id ? 'selected' : ''}
              onClick={() => setSelectedId(conversation.id)}
            >
              <strong>
                {conversation.studentName} ({conversation.studentNumber}) · {label(conversation.categoryId)}
                {conversation.needsHuman ? ' 🙋 상담요청' : ''}
                {conversation.unreadForAdmin ? ' ●' : ''}
              </strong>
              <span className="chatListPreview">
                <span>{conversation.lastMessage || '새 대화'}</span>
                {conversation.lastMessageAt ? <time>{formatChatTime(conversation.lastMessageAt)}</time> : null}
              </span>
            </button>
          ))}
        </aside>
        <div className="chatThread">
          {!selected ? (
            <p className="chatEmpty">왼쪽에서 대화를 선택하세요.</p>
          ) : (
            <>
              <div className="chatMessages" ref={bodyRef}>
                {messages.map((message) => (
                  <div key={message.id} className={`bubble ${message.from}`}>
                    <span className="who">{who(message.from)}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <form className="chatReply" onSubmit={send}>
                <input
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="답장을 입력하세요"
                  aria-label="답장"
                />
                <button className="primary" type="submit"><Send size={16} />보내기</button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function CategoriesEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const emptyDraft = (): Category => ({
    id: makeId('cat'),
    label: '',
    description: '',
    phone: '',
    hours: '',
    order: 0,
  })
  const [draft, setDraft] = useState<Category>(emptyDraft)
  const isEditing = store.categories.some((item) => item.id === draft.id)

  const save = async () => {
    if (!draft.label.trim()) return
    const order = draft.order > 0 ? draft.order : nextOrder(store.categories)
    try {
      await saveDocument('categories', { ...draft, order, label: draft.label.trim() })
      notify(isEditing ? '카테고리를 수정했습니다.' : '카테고리를 추가했습니다.')
      setDraft(emptyDraft())
      await refresh()
    } catch {
      notify('저장에 실패했습니다.', 'error')
    }
  }

  return (
    <EditorShell title="카테고리 관리" request="카테고리">
      <p className="editorHint">
        {isEditing
          ? '카테고리를 수정하고 있습니다. 이름·전화·설명을 고쳐 저장하세요.'
          : '새 카테고리를 추가합니다. 이름만 입력하면 되고, 내부 ID는 자동으로 부여됩니다.'}
      </p>
      <FormRow>
        <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="카테고리 이름 (예: 장학금)" />
        <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="전화번호" />
      </FormRow>
      <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="설명" />
      <input value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} placeholder="운영 시간" />
      <input
        type="number"
        min={1}
        value={draft.order || ''}
        onChange={(event) => setDraft({ ...draft, order: event.target.value === '' ? 0 : Number(event.target.value) })}
        placeholder="표시 순서 (비우면 맨 뒤)"
        aria-label="표시 순서"
      />
      <FormRow>
        <button className="primary" onClick={() => void save()}>{isEditing ? '수정 저장' : '카테고리 추가'}</button>
        {isEditing && <button onClick={() => setDraft(emptyDraft())}>새 카테고리 입력</button>}
      </FormRow>
      <h2>현재 카테고리</h2>
      <List
        rows={store.categories}
        render={(item) => `${item.order}. ${item.label}${item.phone ? ` · ${item.phone}` : ''}`}
        remove={(id) => removeDocument('categories', id).then(refresh)}
        onSelect={setDraft}
        selectedId={draft.id}
        emptyText="아직 등록된 카테고리가 없습니다."
      />
    </EditorShell>
  )
}

function NoticesEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const emptyNotice = (): Notice => ({
    id: makeId('notice'),
    categoryId: store.categories[0]?.id ?? '',
    title: '',
    url: '',
    postedAt: Date.now(),
    order: 0,
    viewCount: 0,
  })
  const [draft, setDraft] = useState<Notice>(emptyNotice)
  const isEditing = store.notices.some((item) => item.id === draft.id)
  const [listFilter, setListFilter] = useState<CategoryId | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredNotices = store.notices.filter((notice) => {
    const matchesCategory = listFilter === 'all' || notice.categoryId === listFilter
    const matchesQuery = notice.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
    return matchesCategory && matchesQuery
  })

  const trimmedUrl = draft.url.trim()
  const urlValid = /^https?:\/\//i.test(trimmedUrl)
  const canSave = draft.title.trim().length > 0 && urlValid

  return (
    <EditorShell title="원문 공지 관리" request="원문 공지">
      <p className="editorHint">
        원문 공지는 <strong>제목 + 원문 URL</strong> 형태로 등록합니다. 학생 화면에서는 제목을 누르면 원문 링크(새 탭)로 이동합니다.
      </p>
      <FormRow>
        <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value as CategoryId })}>
          {store.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="공지 제목" />
      </FormRow>
      <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="원문 URL (예: https://…)" />
      {trimmedUrl.length > 0 && !urlValid && <small className="error">URL은 http:// 또는 https:// 로 시작해야 합니다.</small>}
      <input
        type="number"
        min={1}
        value={draft.order || ''}
        onChange={(event) => setDraft({ ...draft, order: event.target.value === '' ? 0 : Number(event.target.value) })}
        placeholder="노출 순서 (비우면 맨 뒤에 추가됩니다)"
        aria-label="노출 순서"
      />
      <FormRow>
        <button
          className="primary"
          disabled={!canSave}
          onClick={async () => {
            const order = draft.order > 0 ? draft.order : nextOrder(store.notices.filter((notice) => notice.categoryId === draft.categoryId))
            try {
              await saveDocument('notices', { ...draft, order, title: draft.title.trim(), url: trimmedUrl })
              notify(isEditing ? '공지를 수정했습니다.' : '공지를 등록했습니다.')
              setDraft(emptyNotice())
              await refresh()
            } catch {
              notify('저장에 실패했습니다.', 'error')
            }
          }}
        >
          {isEditing ? '공지 수정 저장' : '공지 등록'}
        </button>
        {isEditing && <button onClick={() => setDraft(emptyNotice())}>새로 입력</button>}
      </FormRow>
      <div className="tabs">
        <button className={listFilter === 'all' ? 'active' : ''} onClick={() => setListFilter('all')}>전체</button>
        {store.categories.map((category) => (
          <button
            key={category.id}
            className={listFilter === category.id ? 'active' : ''}
            onClick={() => setListFilter(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="제목 검색" aria-label="공지 제목 검색" />
      <List
        rows={filteredNotices}
        render={(item) => `${item.title} · 조회 ${item.viewCount}`}
        remove={(id) => removeDocument('notices', id).then(refresh)}
        onSelect={setDraft}
        selectedId={draft.id}
        emptyText={searchQuery ? '검색 결과가 없습니다.' : '아직 등록된 공지가 없습니다.'}
      />
    </EditorShell>
  )
}

function FaqEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const emptyFaq = (): FaqEntry => ({ id: makeId('faq'), categoryId: store.categories[0]?.id ?? '', question: '', answer: '', answerImageUrls: [], relatedNoticeIds: [], order: 0, pinned: false, showOnHome: false, viewCount: 0, updatedAt: Date.now() })
  const [draft, setDraft] = useState<FaqEntry>(emptyFaq)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const categoryNotices = store.notices.filter((notice) => notice.categoryId === draft.categoryId)
  const isEditing = store.faqs.some((item) => item.id === draft.id)

  const toggleNotice = (noticeId: string, checked: boolean) => {
    setDraft({
      ...draft,
      relatedNoticeIds: checked
        ? [...draft.relatedNoticeIds, noticeId]
        : draft.relatedNoticeIds.filter((id) => id !== noticeId),
    })
  }

  const removeImage = (url: string) => {
    setDraft({ ...draft, answerImageUrls: draft.answerImageUrls.filter((item) => item !== url) })
  }

  return (
    <EditorShell title="FAQ 관리" request="FAQ">
      <FormRow>
        <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value as CategoryId })}>
          {store.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
        <input value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} placeholder="질문" />
      </FormRow>
      <textarea value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} rows={5} placeholder="답변" />
      <FormRow>
        <input
          type="number"
          min={1}
          value={draft.order || ''}
          onChange={(event) => setDraft({ ...draft, order: event.target.value === '' ? 0 : Number(event.target.value) })}
          placeholder="노출 순서 (비우면 맨 뒤)"
          aria-label="노출 순서"
        />
        <label className="check">
          <input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} />
          대표 질문으로 상단 고정
        </label>
        <label className="check">
          <input type="checkbox" checked={draft.showOnHome} onChange={(event) => setDraft({ ...draft, showOnHome: event.target.checked })} />
          홈 '지금 많이 묻는 질문'에 노출
        </label>
      </FormRow>
      <fieldset>
        <legend>관련 원문 공지</legend>
        {categoryNotices.map((notice) => (
          <label key={notice.id} className="check">
            <input
              type="checkbox"
              checked={draft.relatedNoticeIds.includes(notice.id)}
              onChange={(event) => toggleNotice(notice.id, event.target.checked)}
            />
            {notice.title}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>첨부 이미지</legend>
        {draft.answerImageUrls.length > 0 && (
          <div className="imageThumbs">
            {draft.answerImageUrls.map((url) => (
              <div key={url} className="imageThumb">
                <img src={url} alt="" />
                <button type="button" onClick={() => removeImage(url)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <input type="file" multiple accept="image/*" onChange={(event) => setFiles([...event.target.files ?? []])} />
      </fieldset>
      <FormRow>
        <button
          className="primary"
          disabled={uploading}
          onClick={async () => {
            setUploading(true)
            try {
              const uploadedUrls = await uploadAnswerImages(draft.id, files)
              const order = draft.order > 0 ? draft.order : nextOrder(store.faqs.filter((faq) => faq.categoryId === draft.categoryId))
              const nextDraft = { ...draft, order, answerImageUrls: [...draft.answerImageUrls, ...uploadedUrls] }
              await saveDocument('faqEntries', nextDraft)
              notify(isEditing ? 'FAQ를 수정했습니다.' : 'FAQ를 추가했습니다.')
              setFiles([])
              setDraft(emptyFaq())
              await refresh()
            } catch {
              notify('저장에 실패했습니다.', 'error')
            } finally {
              setUploading(false)
            }
          }}
        >
          {uploading ? '저장 중…' : isEditing ? 'FAQ 수정 저장' : 'FAQ 추가'}
        </button>
        {isEditing && !uploading && <button onClick={() => { setDraft(emptyFaq()); setFiles([]) }}>새로 입력</button>}
      </FormRow>
      <List
        rows={store.faqs}
        render={(item) => `${item.showOnHome ? '🏠 ' : ''}${item.pinned ? '📌 ' : ''}${item.question}`}
        remove={(id) => removeDocument('faqEntries', id).then(refresh)}
        onSelect={(item) => { setDraft(item); setFiles([]) }}
        selectedId={draft.id}
        emptyText="아직 등록된 FAQ가 없습니다."
      />
    </EditorShell>
  )
}

function ChecklistEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(store.checklists[0]?.id ?? '')
  const selected = store.checklists.find((item) => item.id === selectedId)
  const [draft, setDraft] = useState<Checklist | null>(selected ?? null)
  const [newCategoryId, setNewCategoryId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setDraft(selected ?? null)
  }, [selectedId, store.checklists])

  const categoryLabel = (id: CategoryId) =>
    store.categories.find((category) => category.id === id)?.label ?? id

  // 아직 체크리스트가 없는 카테고리만 신규 생성 대상으로 제공한다.
  const categoriesWithout = store.categories.filter(
    (category) => !store.checklists.some((checklist) => checklist.categoryId === category.id),
  )
  const effectiveNewCategoryId = categoriesWithout.some((category) => category.id === newCategoryId)
    ? newCategoryId
    : categoriesWithout[0]?.id ?? ''

  const createChecklist = async () => {
    if (!effectiveNewCategoryId) return
    setCreating(true)
    try {
      const category = store.categories.find((item) => item.id === effectiveNewCategoryId)
      const id = `checklist-${effectiveNewCategoryId}`
      await saveChecklist({
        id,
        categoryId: effectiveNewCategoryId,
        order: category?.order ?? store.checklists.length + 1,
        items: [{ id: makeId('item'), label: '', content: '', order: 1 }],
      })
      await refresh()
      setSelectedId(id)
    } finally {
      setCreating(false)
    }
  }

  const removeChecklist = async () => {
    if (!draft) return
    if (!window.confirm('이 체크리스트를 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await removeDocument('checklists', draft.id)
      notify('체크리스트를 삭제했습니다.')
      await refresh()
      setSelectedId('')
    } catch {
      notify('삭제에 실패했습니다.', 'error')
    }
  }

  return (
    <EditorShell title="체크리스트 관리" request="체크리스트">
      <p className="editorHint">
        카테고리별 '신청 전 체크' 목록을 관리합니다. 전과 등 새 카테고리의 체크리스트를 아래에서 만들 수 있습니다.
      </p>

      <fieldset>
        <legend>새 체크리스트 만들기</legend>
        {categoriesWithout.length > 0 ? (
          <FormRow>
            <select value={effectiveNewCategoryId} onChange={(event) => setNewCategoryId(event.target.value)}>
              {categoriesWithout.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
            <button className="primary" disabled={creating || !effectiveNewCategoryId} onClick={() => void createChecklist()}>
              {creating ? '생성 중…' : '새 체크리스트 만들기'}
            </button>
          </FormRow>
        ) : store.categories.length === 0 ? (
          <p className="editorHint">먼저 카테고리를 등록하세요.</p>
        ) : (
          <p className="editorHint">모든 카테고리에 체크리스트가 있습니다.</p>
        )}
      </fieldset>

      {store.checklists.length === 0 ? (
        <p className="editorHint">아직 체크리스트가 없습니다. 위에서 카테고리를 선택해 만들어 주세요.</p>
      ) : (
        <>
          <h2>체크리스트 편집</h2>
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {store.checklists.map((item) => (
              <option key={item.id} value={item.id}>{categoryLabel(item.categoryId)}</option>
            ))}
          </select>
          {draft && (
            <>
              {draft.items.map((item, index) => (
                <FormRow key={item.id}>
                  <input value={item.label} placeholder="항목명" onChange={(event) => {
                    const items = [...draft.items]
                    items[index] = { ...item, label: event.target.value }
                    setDraft({ ...draft, items })
                  }} />
                  <input value={item.content} placeholder="내용" onChange={(event) => {
                    const items = [...draft.items]
                    items[index] = { ...item, content: event.target.value }
                    setDraft({ ...draft, items })
                  }} />
                  <button onClick={() => setDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={16} /></button>
                </FormRow>
              ))}
              <button onClick={() => setDraft({ ...draft, items: [...draft.items, { id: makeId('item'), label: '', content: '', order: draft.items.length + 1 }] })}>항목 추가</button>
              <FormRow>
                <button className="primary" onClick={async () => {
                  try {
                    await saveChecklist(draft)
                    notify('체크리스트를 저장했습니다.')
                    await refresh()
                  } catch {
                    notify('저장에 실패했습니다.', 'error')
                  }
                }}><Save size={18} />저장</button>
                <button onClick={() => void removeChecklist()}><Trash2 size={16} />체크리스트 삭제</button>
              </FormRow>
            </>
          )}
        </>
      )}
    </EditorShell>
  )
}

function ContactsEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const emptyContact = (): Contact => ({
    id: makeId('c'),
    team: '',
    topic: '',
    ext: '',
    phone: '',
    group: '학사',
    categories: [],
    priority: 2,
    order: 0,
  })
  const [draft, setDraft] = useState<Contact>(emptyContact)
  const isEditing = store.contacts.some((item) => item.id === draft.id)
  const [listFilter, setListFilter] = useState<CategoryId | 'all'>('all')

  const filtered = store.contacts
    .filter((contact) => listFilter === 'all' || contact.categories.includes(listFilter))
    .sort((a, b) => a.order - b.order)

  const toggleCategory = (categoryId: CategoryId, checked: boolean) => {
    setDraft({
      ...draft,
      categories: checked
        ? [...draft.categories, categoryId]
        : draft.categories.filter((id) => id !== categoryId),
    })
  }

  const save = async () => {
    if (!draft.team.trim() || !draft.ext.trim()) return
    const phone = extToPhone(draft.ext)
    const order = draft.order > 0 ? draft.order : nextOrder(store.contacts)
    try {
      await saveDocument('contacts', {
        ...draft,
        order,
        team: draft.team.trim(),
        topic: draft.topic.trim(),
        ext: draft.ext.trim(),
        phone,
      })
      notify(isEditing ? '연락처를 수정했습니다.' : '연락처를 추가했습니다.')
      setDraft(emptyContact())
      await refresh()
    } catch {
      notify('저장에 실패했습니다.', 'error')
    }
  }

  return (
    <EditorShell title="전화번호부 관리" request="전화번호부">
      <p className="editorHint">
        학내 부서 연락처를 등록합니다. 내선번호를 입력하면 전화번호는 자동으로 계산됩니다(예: 3542 → 031-280-3542). 개인 실명은 넣지 마세요.
      </p>
      <FormRow>
        <input value={draft.team} onChange={(event) => setDraft({ ...draft, team: event.target.value })} placeholder="부서/팀명 (예: 교무팀)" />
        <input value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} placeholder="담당 업무 (예: 학적·성적)" />
      </FormRow>
      <FormRow>
        <input value={draft.ext} onChange={(event) => setDraft({ ...draft, ext: event.target.value })} placeholder="내선번호 (예: 3542)" />
        <input value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value })} placeholder="분류 (예: 학사, 장학·복지)" />
      </FormRow>
      <small className="editorHint">계산된 전화번호: {extToPhone(draft.ext) || '—'}</small>
      <fieldset>
        <legend>연결 카테고리</legend>
        {store.categories.map((category) => (
          <label key={category.id} className="check">
            <input
              type="checkbox"
              checked={draft.categories.includes(category.id)}
              onChange={(event) => toggleCategory(category.id, event.target.checked)}
            />
            {category.label}
          </label>
        ))}
      </fieldset>
      <FormRow>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.priority === 1}
            onChange={(event) => setDraft({ ...draft, priority: event.target.checked ? 1 : 2 })}
          />
          카테고리 전화 문의 모달에 대표로 노출
        </label>
        <input
          type="number"
          min={1}
          value={draft.order || ''}
          onChange={(event) => setDraft({ ...draft, order: event.target.value === '' ? 0 : Number(event.target.value) })}
          placeholder="순서 (비우면 맨 뒤)"
          aria-label="순서"
        />
      </FormRow>
      <FormRow>
        <button className="primary" onClick={() => void save()}>{isEditing ? '연락처 수정 저장' : '연락처 추가'}</button>
        {isEditing && <button onClick={() => setDraft(emptyContact())}>새 연락처 입력</button>}
      </FormRow>
      <div className="tabs">
        <button className={listFilter === 'all' ? 'active' : ''} onClick={() => setListFilter('all')}>전체</button>
        {store.categories.map((category) => (
          <button
            key={category.id}
            className={listFilter === category.id ? 'active' : ''}
            onClick={() => setListFilter(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <List
        rows={filtered}
        render={(item) => `${item.priority === 1 ? '⭐ ' : ''}[${item.group}] ${item.team} · ${item.topic} · ${item.phone}`}
        remove={(id) => removeDocument('contacts', id).then(refresh)}
        onSelect={setDraft}
        selectedId={draft.id}
        emptyText="아직 등록된 연락처가 없습니다."
      />
    </EditorShell>
  )
}

function EditorShell({ title, request, children }: { title: string; request: string; children: React.ReactNode }) {
  return <section className="panel"><header className="pageHeader"><div><span>{request}</span><h1>{title}</h1></div></header>{children}</section>
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="formRow">{children}</div>
}

function List<T extends { id: string }>({
  rows,
  render,
  remove,
  onSelect,
  selectedId,
  emptyText = '아직 등록된 항목이 없습니다.',
}: {
  rows: T[]
  render: (item: T) => string
  remove: (id: string) => Promise<void>
  onSelect?: (item: T) => void
  selectedId?: string
  emptyText?: string
}) {
  const handleRemove = async (id: string) => {
    if (!window.confirm('이 항목을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await remove(id)
      notify('삭제되었습니다.')
    } catch {
      notify('삭제에 실패했습니다.', 'error')
    }
  }

  if (rows.length === 0) return <p className="editorHint">{emptyText}</p>

  return (
    <div className="list">
      {rows.map((item) => (
        <div key={item.id} className={item.id === selectedId ? 'editing' : ''}>
          {onSelect ? (
            <button type="button" className="listSelect" onClick={() => onSelect(item)}>
              {render(item)}
            </button>
          ) : (
            <span>{render(item)}</span>
          )}
          <button aria-label="삭제" onClick={() => void handleRemove(item.id)}><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { authenticated, ready, logout } = useAuthState()
  const { store, loading, loadedOnce, error, refresh } = useStore(authenticated)
  if (!ready) return <div className="loading">불러오는 중입니다.</div>
  if (!authenticated) return <LoginPage />
  if (!loadedOnce) return <div className="loading">불러오는 중입니다.</div>

  return (
    <Shell loadError={error} syncing={loading} onRefresh={refresh} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Stats store={store} refresh={refresh} />} />
        <Route path="/chat" element={<ChatConsole store={store} />} />
        <Route path="/log-call" element={<LogCall store={store} refresh={refresh} />} />
        <Route path="/edit/categories" element={<CategoriesEditor store={store} refresh={refresh} />} />
        <Route path="/edit/faqs" element={<FaqEditor store={store} refresh={refresh} />} />
        <Route path="/edit/notices" element={<NoticesEditor store={store} refresh={refresh} />} />
        <Route path="/edit/checklists" element={<ChecklistEditor store={store} refresh={refresh} />} />
        <Route path="/edit/contacts" element={<ContactsEditor store={store} refresh={refresh} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
