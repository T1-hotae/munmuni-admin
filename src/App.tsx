import { BarChart3, Edit3, FileQuestion, ListChecks, LockKeyhole, LogOut, MessageSquare, Newspaper, PhoneCall, Save, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import {
  createPhoneInquiry,
  groupInquiries,
  loadCategories,
  loadChecklists,
  loadFaqs,
  loadInquiries,
  loadNotices,
  loadPresets,
  markConversationReadByAdmin,
  removeDocument,
  saveChecklist,
  saveDocument,
  sendAdminMessage,
  subscribeConversationMessages,
  subscribeConversations,
  uploadAnswerImages,
} from './data'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ADMIN_LOGIN_EMAIL, auth, hasFirebaseConfig } from './firebase'
import type { Category, CategoryId, ChatMessage, Checklist, Conversation, FaqEntry, Inquiry, KeywordPreset, Notice } from './types'

type Store = {
  categories: Category[]
  presets: KeywordPreset[]
  notices: Notice[]
  faqs: FaqEntry[]
  checklists: Checklist[]
  inquiries: Inquiry[]
}

const emptyStore: Store = {
  categories: [],
  presets: [],
  notices: [],
  faqs: [],
  checklists: [],
  inquiries: [],
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}`

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
  const [error, setError] = useState('')
  const refresh = async () => {
    if (!authenticated) return
    setLoading(true)
    setError('')
    try {
      const [categories, presets, notices, faqs, checklists, inquiries] = await Promise.all([
        loadCategories(),
        loadPresets(),
        loadNotices(),
        loadFaqs(),
        loadChecklists(),
        loadInquiries(),
      ])
      setStore({ categories, presets, notices, faqs, checklists, inquiries })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firebase 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [authenticated])
  return { store, loading, error, refresh }
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
          <div className="brandMark">무</div>
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
  store,
  loadError,
  onLogout,
}: {
  children: React.ReactNode
  store: Store
  loadError: string
  onLogout: () => void
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <strong>문무니</strong>
        <nav>
          <Link to="/"><BarChart3 size={18} />통계</Link>
          <Link to="/chat"><MessageSquare size={18} />채팅 상담</Link>
          <Link to="/log-call"><PhoneCall size={18} />전화 기록</Link>
          <Link to="/edit/categories"><Edit3 size={18} />카테고리</Link>
          <Link to="/edit/faqs"><FileQuestion size={18} />FAQ</Link>
          <Link to="/edit/notices"><Newspaper size={18} />원문 공지</Link>
          <Link to="/edit/checklists"><ListChecks size={18} />체크리스트</Link>
        </nav>
        <button type="button" onClick={onLogout}>
          <LogOut size={18} />로그아웃
        </button>
      </aside>
      <main className="content">
        {loadError && <div className="notice">{loadError}</div>}
        {!hasFirebaseConfig && (
          <div className="notice">
            Firebase 연결값이 없습니다. `.env`에 VITE_FIREBASE_* 값을 넣은 뒤 앱을 다시 실행하세요.
          </div>
        )}
        {!loadError && hasFirebaseConfig && store.categories.length === 0 && (
          <div className="notice">먼저 학생 웹의 seed를 실행해 기본 데이터를 넣으세요.</div>
        )}
        {children}
      </main>
    </div>
  )
}

function Stats({ store }: { store: Store }) {
  const totalInquiries = store.inquiries.length
  const chatCount = store.inquiries.filter((item) => item.source === 'chat').length
  const phoneCount = store.inquiries.filter((item) => item.source === 'phone').length
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

  return (
    <>
      <header className="pageHeader">
        <div>
          <span>통계</span>
          <h1>운영 통계</h1>
        </div>
        <Link className="primary" to="/log-call">전화 문의 기록</Link>
      </header>
      <section className="stats">
        <article><strong>{totalInquiries}</strong><span>전체 문의</span></article>
        <article><strong>{chatCount}</strong><span>채팅 문의</span></article>
        <article><strong>{phoneCount}</strong><span>전화 문의</span></article>
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
        <h2>많이 묻는 키워드</h2>
        <table>
          <thead><tr><th>키워드</th><th>전체</th><th>채팅</th><th>전화</th></tr></thead>
          <tbody>
            {topKeywords.map((group) => (
              <tr key={group.key}>
                <td>{group.keyword}</td>
                <td>{group.total}</td>
                <td>{group.chat}</td>
                <td>{group.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="twoColumnStats">
        <div className="panel">
          <h2>FAQ 조회수 TOP 5</h2>
          <ol className="rankList">
            {topFaqs.map((faq) => (
              <li key={faq.id}><span>{faq.question}</span><strong>{faq.viewCount}</strong></li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <h2>공지 조회수 TOP 5</h2>
          <ol className="rankList">
            {topNotices.map((notice) => (
              <li key={notice.id}><span>{notice.title}</span><strong>{notice.viewCount}</strong></li>
            ))}
          </ol>
        </div>
      </div>
    </>
  )
}

function LogCall({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const [categoryId, setCategoryId] = useState<CategoryId | ''>('')
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState('')
  const presets = store.presets.filter((item) => item.categoryId === categoryId)

  const save = async (nextKeyword = keyword) => {
    if (!categoryId || !nextKeyword.trim()) return
    await createPhoneInquiry(categoryId, nextKeyword.trim(), detail.trim())
    setKeyword('')
    setDetail('')
    await refresh()
  }

  return (
    <section>
      <header className="pageHeader"><div><span>요청사항 2</span><h1>전화 문의 기록</h1></div></header>
      <div className="panel">
        <h2>1. 카테고리 선택</h2>
        <div className="buttonGrid">
          {store.categories.map((category) => (
            <button key={category.id} className={categoryId === category.id ? 'selected' : ''} onClick={() => setCategoryId(category.id)}>
              {category.label}
            </button>
          ))}
        </div>
        {categoryId && (
          <>
            <h2>2. 예시 질문 선택</h2>
            <div className="buttonGrid">
              {presets.map((preset) => <button key={preset.id} onClick={() => void save(preset.label)}>{preset.label}</button>)}
            </div>
            <h2>직접 입력</h2>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="질문 요약" />
            <textarea value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="상세 메모" rows={4} />
            <button className="primary" onClick={() => void save()}>기록 저장</button>
          </>
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

  // 학생이 실제로 메시지를 보내지 않은 대화(자동 안내만 있는 빈 대화)는 목록에서 숨긴다.
  const orderedConversations = conversations
    .filter((conversation) => conversation.studentMessageCount > 0)
    .sort((a, b) => Number(b.needsHuman) - Number(a.needsHuman))

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
              <span>{conversation.lastMessage || '새 대화'}</span>
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
  const [draft, setDraft] = useState<Category>({
    id: 'etc',
    label: '',
    description: '',
    phone: '',
    hours: '',
    order: 999,
  })

  return (
    <EditorShell title="카테고리 관리" request="요청사항 4">
      <FormRow>
        <select value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value as CategoryId })}>
          <option value="transfer">transfer</option>
          <option value="course">course</option>
          <option value="leave">leave</option>
          <option value="etc">etc</option>
        </select>
        <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="표시 이름" />
        <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="전화번호" />
      </FormRow>
      <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="설명" />
      <input value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} placeholder="운영 시간" />
      <input
        type="number"
        value={draft.order}
        onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}
        placeholder="순서"
      />
      <button className="primary" onClick={async () => { await saveDocument('categories', draft); await refresh() }}>저장</button>
      <List
        rows={store.categories}
        render={(item) => `${item.order}. ${item.label} · ${item.phone}`}
        remove={(id) => removeDocument('categories', id).then(refresh)}
        onSelect={setDraft}
      />
    </EditorShell>
  )
}

function NoticesEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<Notice>({
    id: makeId('notice'),
    categoryId: 'transfer',
    title: '',
    url: '',
    postedAt: Date.now(),
    order: 999,
    viewCount: 0,
  })
  const isEditing = store.notices.some((item) => item.id === draft.id)
  const [listFilter, setListFilter] = useState<CategoryId | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredNotices = store.notices.filter((notice) => {
    const matchesCategory = listFilter === 'all' || notice.categoryId === listFilter
    const matchesQuery = notice.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
    return matchesCategory && matchesQuery
  })

  return (
    <EditorShell title="원문 공지 관리" request="요청사항 4">
      <FormRow>
        <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value as CategoryId })}>
          {store.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="공지 제목" />
      </FormRow>
      <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="원문 URL" />
      <input
        type="number"
        value={draft.order}
        onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}
        placeholder="순서"
      />
      <button
        className="primary"
        onClick={async () => {
          await saveDocument('notices', draft)
          setDraft({ id: makeId('notice'), categoryId: 'transfer', title: '', url: '', postedAt: Date.now(), order: 999, viewCount: 0 })
          await refresh()
        }}
      >
        {isEditing ? '공지 수정 저장' : '공지 등록'}
      </button>
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
      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="제목 검색" />
      <List
        rows={filteredNotices}
        render={(item) => `${item.title} · 조회 ${item.viewCount}`}
        remove={(id) => removeDocument('notices', id).then(refresh)}
        onSelect={setDraft}
      />
    </EditorShell>
  )
}

function FaqEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<FaqEntry>({ id: makeId('faq'), categoryId: 'transfer', question: '', answer: '', answerImageUrls: [], relatedNoticeIds: [], order: 999, pinned: false, viewCount: 0, updatedAt: Date.now() })
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
    <EditorShell title="FAQ 관리" request="요청사항 4">
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
          value={draft.order}
          onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}
          placeholder="순서"
        />
        <label className="check">
          <input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} />
          대표 질문으로 상단 고정
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
      <button
        className="primary"
        disabled={uploading}
        onClick={async () => {
          setUploading(true)
          try {
            const uploadedUrls = await uploadAnswerImages(draft.id, files)
            const nextDraft = { ...draft, answerImageUrls: [...draft.answerImageUrls, ...uploadedUrls] }
            await saveDocument('faqEntries', nextDraft)
            setFiles([])
            setDraft({ id: makeId('faq'), categoryId: 'transfer', question: '', answer: '', answerImageUrls: [], relatedNoticeIds: [], order: 999, pinned: false, viewCount: 0, updatedAt: Date.now() })
            await refresh()
          } finally {
            setUploading(false)
          }
        }}
      >
        {uploading ? '저장 중…' : isEditing ? 'FAQ 수정 저장' : 'FAQ 추가'}
      </button>
      <List rows={store.faqs} render={(item) => item.question} remove={(id) => removeDocument('faqEntries', id).then(refresh)} onSelect={(item) => { setDraft(item); setFiles([]) }} />
    </EditorShell>
  )
}

function ChecklistEditor({ store, refresh }: { store: Store; refresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(store.checklists[0]?.id ?? '')
  const selected = store.checklists.find((item) => item.id === selectedId)
  const [draft, setDraft] = useState<Checklist | null>(selected ?? null)

  useEffect(() => {
    setDraft(selected ?? null)
  }, [selectedId, store.checklists])

  if (!draft) return <EditorShell title="체크리스트 관리" request="요청사항 4">체크리스트가 없습니다.</EditorShell>

  return (
    <EditorShell title="체크리스트 관리" request="요청사항 4">
      <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        {store.checklists.map((item) => (
          <option key={item.id} value={item.id}>
            {store.categories.find((category) => category.id === item.categoryId)?.label ?? item.categoryId}
          </option>
        ))}
      </select>
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
      <button className="primary" onClick={async () => { await saveChecklist(draft); await refresh() }}><Save size={18} />저장</button>
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
}: {
  rows: T[]
  render: (item: T) => string
  remove: (id: string) => Promise<void>
  onSelect?: (item: T) => void
}) {
  return (
    <div className="list">
      {rows.map((item) => (
        <div key={item.id}>
          {onSelect ? (
            <button type="button" className="listSelect" onClick={() => onSelect(item)}>
              {render(item)}
            </button>
          ) : (
            <span>{render(item)}</span>
          )}
          <button onClick={() => void remove(item.id)}><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { authenticated, ready, logout } = useAuthState()
  const { store, loading, error, refresh } = useStore(authenticated)
  if (!ready) return <div className="loading">불러오는 중입니다.</div>
  if (!authenticated) return <LoginPage />
  if (loading) return <div className="loading">불러오는 중입니다.</div>

  return (
    <Shell store={store} loadError={error} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Stats store={store} />} />
        <Route path="/chat" element={<ChatConsole store={store} />} />
        <Route path="/log-call" element={<LogCall store={store} refresh={refresh} />} />
        <Route path="/edit/categories" element={<CategoriesEditor store={store} refresh={refresh} />} />
        <Route path="/edit/faqs" element={<FaqEditor store={store} refresh={refresh} />} />
        <Route path="/edit/notices" element={<NoticesEditor store={store} refresh={refresh} />} />
        <Route path="/edit/checklists" element={<ChecklistEditor store={store} refresh={refresh} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
