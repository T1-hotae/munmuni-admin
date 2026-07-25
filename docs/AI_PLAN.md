# 문무니 관리자 업무 AI 자동화 계획

관리자가 손으로 하는 일을 AI로 줄이는 계획서. 현재 코드 기준(관리자 앱 `han-non-e-admin`, 학생 웹 `han-non-e`)으로 작성.

---

## 1. 현재 관리자 부담 진단

| 업무 | 현재 방식 | 문제 |
|---|---|---|
| 원문 공지 등록 | `NoticesEditor` — 제목·URL·카테고리·순서를 **전부 손으로** 입력 | 공지 하나당 학교 홈페이지에서 복사 → 카테고리 판단 → 입력. 건수가 많으면 그대로 시간이 됨 |
| 공지 본문 부재 | `notices`에 `title`/`url`만 있음 (`src/types.ts:25`) | 학생 챗봇이 KB로 받는 공지는 **제목뿐**(`ChatPage.tsx` `buildKb`) → AI가 내용으로 답을 못 함 → 학생이 상담사 연결 → **관리자 채팅 업무 증가** |
| 채팅 상담 | `ChatConsole` — 대화 읽고 직접 타이핑 | 대화가 길어지면 앞부분을 다 읽어야 함. FAQ/공지에 이미 있는 답도 매번 손으로 씀 |
| 전화 메모 | `LogCall` — 카테고리 선택 + 메모 | 카테고리를 사람이 매번 판단 |
| FAQ 작성 | `FaqEditor` — 백지에서 작성 | 실제로 많이 들어온 질문이 무엇인지 알기 어려움 |
| 통계 | `groupInquiries`가 `카테고리:키워드` **문자열 완전일치**로 묶음 (`src/data.ts:146`) | `keyword`가 학생의 첫 질문 문장이라 사실상 전부 다른 그룹 → "많이 묻는 키워드" 표가 거의 무의미 |

핵심 인과관계: **공지 본문이 KB에 없다 → AI 답변률 낮다 → 상담사 연결 늘어난다 → 관리자가 바쁘다.** 그래서 공지 파이프라인부터 손대는 것이 관리자 시간 절감 효과가 가장 크다.

---

## 2. 설계 원칙 (먼저 합의할 것)

1. **API 키는 관리자 앱(Tauri exe)에 절대 넣지 않는다.** `.exe`는 사용자 PC에 있어 문자열 추출이 가능하다. `VITE_OPENAI_*` 금지.
2. **AI 호출은 전부 서버(Vercel) 경유.** 학생 웹에 이미 `/api/chat`이 있으므로 같은 Vercel 프로젝트에 `/api/admin/*`를 추가한다. `OPENAI_API_KEY`는 기존 서버 환경변수 그대로 재사용.
3. **관리자 엔드포인트는 인증한다.** 관리자 앱이 Firebase ID 토큰을 `Authorization: Bearer`로 보내고, 서버가 `firebase-admin`(이미 학생 웹 devDependency에 있음)으로 검증 + `sign_in_provider === 'password'` 확인. `firestore.rules`의 `isAdmin()`과 같은 기준.
4. **AI 출력은 항상 "초안"이다.** 학생에게 나가는 답변·게시물은 관리자가 확인/수정 후 저장·전송. 자동 전송 없음. 학사 정보 오답 리스크 때문.
5. **요약은 원문을 대체하지 않는다.** 공지 요약을 학생에게 보일 때 원문 링크를 항상 같이 노출.
6. **학생 AI 대화 비공개 원칙은 유지한다.** 현재 규칙상 관리자는 `needsHuman == true` 대화만, `from != 'ai'` 메시지만 읽는다(`firestore.rules`, `data.ts:245`). 지식 격차 수집은 **대화 노출이 아니라 익명 질문 텍스트만 별도 기록**하는 방식으로 한다.
7. **`firestore.rules` / `firestore.indexes.json` 변경은 배포해야 적용된다** — 학생 웹 저장소에서 `firebase deploy --only firestore:rules,firestore:indexes`.

---

## 3. 기능별 계획

### P1. 공지 등록 자동화 — 붙여넣기/URL → 구조화 (최우선)

**관리자 동작:** 공지 URL을 붙여넣거나 본문 텍스트를 붙여넣고 "AI로 채우기" 클릭 → 제목·카테고리·요약·신청기간·대상이 폼에 채워짐 → 눈으로 확인하고 저장.

**서버:** `POST /api/admin/notice-extract`
- 입력: `{ url?: string, rawText?: string, categories: {id,label}[] }`
- `url`이면 서버에서 fetch → HTML 태그 제거로 본문 텍스트 추출
- LLM 구조화 출력(기존 `/api/chat`과 같은 `json_schema` + `strict: true` 패턴):
  ```
  { title, categoryId, summary, body, period: {start?, end?}, targetAudience, confidence }
  ```
- 출력: 위 객체 + `warnings[]`

**데이터 변경 (`notices`):** `summary: string`, `body: string`, `period?: {start,end}`, `targetAudience?: string`, `aiFilled: boolean`, `sourceFetchedAt?: number` 추가. 기존 문서는 빈 값 폴백(`data.ts`의 `loadNotices` 매퍼에 기본값 추가) — 마이그레이션 불필요.

**부수 효과(중요):** 학생 웹 `ChatPage.tsx`의 `buildKb`에서 `notices`에 `body: item.summary || item.body`를 넣으면 **AI가 공지 내용으로 답하게 된다.** 이게 상담사 연결 건수를 직접 줄인다.

**실패 대비:** 학교 페이지가 로그인 필요/JS 렌더링이면 fetch가 실패한다. 그래서 **"본문 붙여넣기 → 구조화"를 1차 경로**로, URL fetch는 보조로 구현. PDF/이미지 공지는 2단계에서 vision 입력 추가 검토.

**파일:** `han-non-e/api/admin/notice-extract.ts`(신규), `han-non-e-admin/src/ai.ts`(신규), `NoticesEditor`(`src/App.tsx:580`), `src/types.ts`, `src/data.ts`, 학생 웹 `ChatPage.tsx`·`inquiryService.ts`·`types/academic.ts`

**난이도:** 중 / **절감:** 공지 1건 3~5분 → 30초

---

### P2. 채팅 상담 어시스트 — 요약 카드 + 답변 초안

보류돼 있던 "AI 요약" 아이디어의 **확정된 범위**: 채팅 목록 미리보기가 아니라, **관리자가 대화를 열었을 때의 상단 요약 카드 + 답장 초안**.

**관리자 동작:** `/chat`에서 대화 선택 → 상단에 요약 카드(① 학생이 묻는 것 ② 판단에 필요한 확인사항 ③ 관련 FAQ/공지 후보) → 답장창 "AI 초안" 버튼 → 초안이 입력창에 들어옴 → 수정 후 전송.

**서버:** `POST /api/admin/assist`
- 입력: `{ mode: 'summary' | 'draft', messages: {from,text}[], kb: {...} }` (kb는 관리자 앱 `store`에서 조립 — 이미 전부 메모리에 있음)
- 출력: `{ summary: {ask, needToCheck[], relatedIds[]} }` 또는 `{ draft, relatedIds[], cautions[] }`

**설계 포인트**
- **캐싱:** 요약은 `conversationId + 마지막 메시지 시각`으로 관리자 앱 메모리에 캐시. 대화를 다시 열 때마다 재호출하지 않는다.
- **초안은 버튼을 눌러야만** 호출(자동 호출 금지 — 비용·오답 방지).
- 초안에 근거 FAQ/공지 id를 함께 받아 관리자가 링크를 바로 붙일 수 있게 한다.
- 초안 전송 시 `sendAdminMessage`는 그대로 사용(메시지 `from`은 `admin`). AI 초안이었다는 사실은 저장하지 않아도 되고, 통계를 원하면 `draftAssisted: true` 필드만 추가.

**파일:** `han-non-e/api/admin/assist.ts`(신규), `han-non-e-admin/src/ai.ts`, `ChatConsole`(`src/App.tsx:418`), `src/data.ts`(선택)

**난이도:** 중 / **절감:** 답장 1건 3~4분 → 1분 이내

---

### P3. 문의 자동 분류 + 주제 클러스터링 → 통계 정상화

**문제:** `groupInquiries`가 질문 문장 완전일치로 묶어서 통계가 안 나온다. 학생 웹의 `detectCategory`도 키워드 규칙 기반이라 새 카테고리·표현 변화에 약하다.

**계획**
1. `inquiries` 문서에 `topic: string`(정규화된 주제 라벨, 예: "전과 신청 기간"), `topicKey: string` 추가.
2. 학생 웹에서 문의가 생길 때 분류를 하지 않고(학생 대기 시간·비용 문제), **관리자 앱에서 배치로** 라벨링: `POST /api/admin/classify`에 `topic`이 비어 있는 문의 최대 N건을 묶어 보내고, 기존 `topic` 목록을 후보로 주어 **새 라벨 남발을 막는다**. 결과를 Firestore에 write(관리자 권한이므로 규칙 변경 불필요 — `inquiries` update는 이미 `isAdmin()`).
3. `groupInquiries`를 `topicKey` 우선(없으면 기존 keyword)으로 묶도록 수정 → 통계 페이지의 "많이 묻는 주제" 표가 실제로 동작.
4. `LogCall` 전화 메모: 메모를 입력하면 카테고리를 AI가 추정해 select에 미리 선택(관리자는 틀렸을 때만 고침).

**파일:** `han-non-e/api/admin/classify.ts`(신규), `src/data.ts`(`groupInquiries`, 매퍼), `Stats`·`LogCall`(`src/App.tsx:269`,`:363`), `src/types.ts`

**난이도:** 중 / **절감:** 직접적인 시간 절감보다 **"무엇을 FAQ로 만들어야 하는가"를 알게 되는 값**이 큼 → P4의 입력

---

### P4. 지식 격차 리포트 + FAQ 초안 자동 제안

**목표:** 문의 총량 자체를 줄이는 선순환. AI가 답 못 한 질문을 모아 FAQ를 만들게 한다.

**수집(원칙 6 준수):** 학생 웹 `sendToAi`에서 `result.confident === false`일 때, 대화를 노출하는 대신 **익명 레코드**를 남긴다.
- 신규 컬렉션 `knowledgeGaps`: `{ question, categoryId, createdAt, resolvedFaqId? }` — 학생 식별정보·대화 id 없음
- `firestore.rules` 추가: `allow create: if signedIn() && ...`, `allow read, update, delete: if isAdmin()` → **배포 필요**
- 이미 `inquiries`에 첫 질문이 남으므로, 최소 구현으로는 `inquiries`에 `aiUnresolved: boolean`만 추가하는 방안도 가능(컬렉션 추가 없음). 둘 중 하나 선택.

**리포트 화면:** 관리자 앱에 `/insights` 신규 페이지
- "AI가 답하지 못한 질문 TOP N"(주제별 묶음, 건수 순)
- 각 행에 **"FAQ 초안 만들기"** 버튼 → `POST /api/admin/faq-draft`(같은 주제 질문들 + 기존 KB) → `question`/`answer`/`categoryId`/근거 공지 id 초안 → `FaqEditor` 폼에 프리필 → 관리자가 검수 후 저장
- 상담사가 실제로 답한 대화도 같은 방식으로 "이 답변을 FAQ로" 버튼 제공

**파일:** `han-non-e/api/admin/faq-draft.ts`(신규), 학생 웹 `ChatPage.tsx`·`chatService.ts`·`firestore.rules`, 관리자 앱 신규 `Insights` 페이지 + 사이드바 항목

**난이도:** 중상 / **절감:** 장기적으로 가장 큼(반복 문의 감소)

---

### P5. 선택 기능 (후순위)

- **KB 일관성 검사:** FAQ·공지·체크리스트 사이의 모순(기간 불일치, 폐지된 절차) 탐지 리포트. 학기 초 1회 돌리는 용도.
- **관리자 자연어 검색:** "장학 관련 공지 중 이번 학기 것" 같은 질의로 목록 필터. 편의 기능이며 부담 절감 효과는 작다.
- **공지 일괄 등록:** 여러 URL을 한 번에 넣어 큐로 처리. P1이 안정된 뒤.

---

## 4. 단계별 로드맵

| 단계 | 내용 | 산출물 |
|---|---|---|
| **Phase 0** (반나절) | 서버 기반: `/api/admin/_auth.ts`(ID 토큰 검증 헬퍼), 관리자 앱 `src/ai.ts`(fetch 래퍼 + `VITE_AI_API_BASE`), 로컬 개발 시 `vercel dev` 연결 확인 | 인증된 AI 엔드포인트 1개가 관리자 앱에서 호출됨 |
| **Phase 1** (1~2일) | P1 공지 구조화 + 학생 웹 KB에 공지 본문/요약 투입 | 공지 입력 시간 급감 + AI 답변률 상승 |
| **Phase 2** (1~2일) | P2 상담 요약 카드 + 답변 초안 | 채팅 응대 시간 감소 |
| **Phase 3** (1일) | P3 분류/클러스터링, 통계 페이지 정상화, 전화 메모 카테고리 자동 추정 | 쓸 수 있는 통계 |
| **Phase 4** (1~2일) | P4 `knowledgeGaps` + `/insights` + FAQ 초안 | 문의 총량 감소 사이클 |

각 Phase는 독립 배포 가능. Phase 1만 해도 체감 효과가 나온다.

---

## 5. 비용 (gpt-4o-mini 기준, 현재 `OPENAI_MODEL` 유지 가정)

| 작업 | 1회 대략 토큰 | 1회 비용 |
|---|---|---|
| 공지 구조화 | in 3k / out 0.5k | 약 1원 |
| 대화 요약 | in 2k / out 0.3k | 1원 미만 |
| 답변 초안 (KB 포함) | in 6k / out 0.4k | 약 2원 |
| 문의 분류 (20건 배치) | in 2k / out 0.5k | 1원 미만 |

관리자 작업량을 하루 공지 20건 + 상담 30건으로 잡아도 **월 수천 원 수준**으로, 관리자 기능의 AI 비용은 사실상 문제가 되지 않는다.

비용의 대부분은 이미 **학생 챗봇** 쪽이다 — `buildKb()`가 매 턴 전체 KB를 프롬프트로 보낸다(`ChatPage.tsx`). 공지 본문을 KB에 추가하면 이 프롬프트가 커지므로, Phase 1과 함께 아래를 같이 처리한다.
- 공지는 **`summary`(짧은 요약)만 KB에 넣고 `body` 전문은 넣지 않는다.**
- 시스템 프롬프트(KB) 부분을 프롬프트 캐싱이 걸리도록 **앞쪽에 고정 배치**하고 대화 이력을 뒤에 둔다(현재 구조가 이미 그렇다 — 유지).
- KB 문자열을 매 요청 조립하는 대신, 관리자 저장 시점에 만들어 두는 캐시 문서(`aiKb/current`)를 두는 방안도 검토 가능(Phase 3 이후).

---

## 6. 리스크와 안전장치

| 리스크 | 대응 |
|---|---|
| AI가 없는 기간/조건을 지어냄 | 구조화·초안 모두 **관리자 승인 후 저장**. `confidence` 낮으면 폼에 경고 배지 표시 |
| 요약만 보고 학생이 오해 | 학생 화면에 요약과 **원문 링크를 항상 함께** 노출 |
| 공지 fetch 실패(로그인/JS 페이지) | 붙여넣기 경로를 기본으로. fetch 실패 시 명확한 안내 |
| 관리자 엔드포인트 무단 호출 | Firebase ID 토큰 검증 + `sign_in_provider == 'password'` 확인. 키는 서버에만 |
| 학생 AI 대화 노출 | 대화를 열지 않고 익명 질문 텍스트만 수집(`knowledgeGaps`) |
| 규칙/인덱스 미배포로 기능이 조용히 실패 | Phase 4 시작 시 `firebase deploy --only firestore:rules,firestore:indexes` 체크리스트에 명시 |
| 분류 라벨 난립 | 분류 요청에 **기존 라벨 목록을 후보로 함께 전달**, 새 라벨 생성은 최소화 |

---

## 7. 열려 있는 결정 사항

1. 공지 자동화의 1차 입력 경로 — **본문 붙여넣기**만으로 시작할지, URL fetch까지 같이 넣을지
2. 지식 격차 저장 — 신규 `knowledgeGaps` 컬렉션 vs `inquiries.aiUnresolved` 필드만 추가(규칙 변경 최소)
3. 학생 챗봇 KB에 공지를 넣을 때 `summary`만 넣을지, 상위 N건은 `body`까지 넣을지
4. 관리자 앱 배포 형태 — AI 서버 주소(`VITE_AI_API_BASE`)를 빌드에 박을지, 앱 설정 화면에서 입력받을지
