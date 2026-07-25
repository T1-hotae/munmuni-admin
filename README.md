# 문무니 관리자

강남대학교 학사 안내 서비스 **문무니(문의할게 무니?)**의 데스크톱 관리자 콘솔입니다.
Tauri 2 + React + TypeScript로 만들었고, Firebase Auth로 로그인한 뒤 Firestore·Storage에 있는 상담·공지·FAQ 데이터를 관리합니다.

학생 웹(`han-non-e`)과 **같은 Firebase 프로젝트**를 공유합니다. 여기서 등록한 카테고리·FAQ·공지·체크리스트·연락처가 곧 학생 화면과 AI 챗봇의 지식이 됩니다.

> 문서
> - 서비스 개요(문제 정의·핵심 기능·피드백 반영) → [docs/OVERVIEW.md](docs/OVERVIEW.md)
> - UI 디자인 시스템(학생 웹 기준) → [docs/DESIGN.md](docs/DESIGN.md)
> - 관리자 업무 AI 자동화 계획 → [docs/AI_PLAN.md](docs/AI_PLAN.md)

---

## 화면 구성

로그인하면 좌측 사이드바 + 우측 콘텐츠 2단 레이아웃으로 진입합니다. 라우팅은 [`src/App.tsx`](src/App.tsx) 하단에 모여 있습니다.

| 메뉴 | 경로 | 하는 일 |
| --- | --- | --- |
| 통계 | `/` | 전체/채팅/전화 문의 수, 게시 FAQ·공지 수, 카테고리별 문의 분포, 많이 묻는 키워드, FAQ·공지 조회수 TOP 5 |
| 채팅 상담 | `/chat` | 상담 요청 대화 실시간 구독 → 대화 선택 → 답장 전송 |
| 전화 기록 | `/log-call` | 전화로 받은 문의를 카테고리 + 메모로 저장(통계에 집계), 최근 메모 20건 확인 |
| 카테고리 | `/edit/categories` | 상담 카테고리(라벨·설명·대표번호·운영시간·순서) 관리 |
| FAQ | `/edit/faqs` | 질문·답변 작성, 답변 이미지 업로드, 관련 공지 연결, 상단 고정·홈 노출 설정 |
| 원문 공지 | `/edit/notices` | 학교 공지를 **제목 + 원문 URL**로 등록(카테고리 필터·제목 검색 지원) |
| 체크리스트 | `/edit/checklists` | 카테고리별 '신청 전 체크리스트' 항목 관리 |
| 전화번호부 | `/edit/contacts` | 학내 부서 연락처(팀·업무·내선) 관리 |

### 채팅 상담에서 보이는 것 / 보이지 않는 것

학생의 AI 대화는 관리자에게 **노출하지 않는 것이 원칙**입니다. 코드와 Firestore 보안 규칙이 같은 기준으로 두 번 거릅니다.

- 대화 목록: `needsHuman == true`(= 학생이 상담사 연결을 요청한 대화)만 구독합니다. 그중 학생이 실제로 메시지를 보낸 대화만 화면에 표시합니다.
- 메시지: `from != 'ai'`만 읽어옵니다. AI 자동응답은 상담사에게 보이지 않습니다.
- 대화를 열면 `unreadForAdmin`이 해제되고, 답장을 보내면 `status: 'answered'` + `unreadForStudent: true`로 갱신됩니다.

구현은 [`src/data.ts`](src/data.ts)의 `subscribeConversations` / `subscribeConversationMessages` / `sendAdminMessage`에 있습니다.

### 전화번호 자동 보정

전화번호부에서 내선번호만 입력하면 걸 수 있는 전체 번호로 변환합니다([`src/App.tsx`](src/App.tsx) `extToPhone`).

| 입력 | 결과 |
| --- | --- |
| `3123` | `031-280-3123` |
| `7123` | `031-899-7123` |
| `280-3123` | `031-280-3123` |
| `0`으로 시작 | 입력값 그대로 |

---

## 기술 스택

- Tauri 2 (Rust) — 데스크톱 셸, NSIS 설치 파일 번들
- React 18 + React Router 6 + TypeScript
- Vite (dev 서버 포트 **1420** 고정)
- Firebase Auth / Firestore / Storage
- lucide-react (아이콘)

---

## 사전 준비

- Node.js와 npm
- Rust 및 Tauri 빌드 환경 ([Tauri prerequisites](https://tauri.app/start/prerequisites/) — Windows는 MSVC 빌드 도구 + WebView2)
- Firebase 프로젝트
  - Email/Password 로그인 활성화
  - 관리자 계정 1개 생성
  - Firestore·Storage 사용 설정
  - 보안 규칙·인덱스 배포 (아래 [Firestore](#firestore) 참고)

## 환경변수

`.env.example`을 `.env`로 복사한 뒤 Firebase 웹 앱 설정값을 채웁니다.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ADMIN_LOGIN_EMAIL=admin@han-non-e.internal
```

로그인 화면에는 **비밀번호만** 입력합니다. 이메일은 `VITE_ADMIN_LOGIN_EMAIL` 값을 사용하며(기본값 `admin@han-non-e.internal`), 비밀번호는 Firebase Auth에 등록된 해당 계정의 비밀번호입니다.

값이 하나라도 비어 있으면 Firebase를 초기화하지 않고, 화면 상단에 안내 배너가 뜨며 로그인이 막힙니다([`src/firebase.ts`](src/firebase.ts) `hasFirebaseConfig`).

## 실행

```bash
npm install
npm run tauri:dev
```

프론트엔드만 브라우저에서 확인할 때:

```bash
npm run dev     # http://localhost:1420
```

## 빌드

```bash
npm run build        # 타입 체크(tsc -b) + Vite 번들 → dist/
npm run tauri:build  # 위 빌드 후 실행 파일·설치 파일 생성
```

산출물(`src-tauri/target/`은 git에서 제외됨):

| 결과물 | 경로 |
| --- | --- |
| 실행 파일 | `src-tauri\target\release\han-non-e-admin.exe` |
| 설치 파일(NSIS) | `src-tauri\target\release\bundle\nsis\문무니 관리자_0.1.0_x64-setup.exe` |

창 제목·앱 이름은 `문무니 관리자`, 식별자는 `internal.han-non-e.admin`입니다([`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json)).

---

## 프로젝트 구조

```
src/
  App.tsx      화면 전체 (로그인 · 사이드바 · 8개 페이지 · 공통 폼 컴포넌트)
  data.ts      Firestore 읽기/쓰기 · 실시간 구독 · 문의 집계
  types.ts     도메인 타입 (Category, FaqEntry, Notice, Conversation …)
  firebase.ts  Firebase 초기화 (환경변수 누락 시 undefined 반환)
  styles.css   전역 스타일
  assets/      마스코트 이미지
src-tauri/     Tauri 설정 · Rust 진입점 · 아이콘
docs/          서비스 개요 · 디자인 시스템 · AI 자동화 계획
```

로그인 후 `useStore`가 카테고리·공지·FAQ·체크리스트·연락처·문의를 한 번에 불러와 메모리에 들고 있고, 저장/삭제 후 `refresh()`로 다시 읽습니다. 채팅만 실시간 구독(`onSnapshot`)입니다.

---

## Firestore

### 컬렉션

| 컬렉션 | 내용 | 정렬 |
| --- | --- | --- |
| `categories` | 상담 카테고리 (라벨·설명·전화·운영시간) | `order` |
| `faqEntries` | FAQ 질문·답변, 답변 이미지 URL, 관련 공지 id, 고정·홈 노출 여부, 조회수 | `order` |
| `notices` | 학교 원문 공지 (제목·URL·게시일·조회수) | 클라이언트 |
| `checklists` | 카테고리별 체크리스트 (항목 배열 내장) | `order` |
| `contacts` | 학내 부서 연락처 (팀·업무·내선·그룹·우선순위) | `order` |
| `inquiries` | 채팅/전화 문의 기록 (`source`, `categoryId`, `keyword`, `status`) | `createdAt` desc |
| `conversations` | 학생별 채팅 대화 + 하위 `messages` | `lastMessageAt` desc |

카테고리 id는 고정 문자열이 아니라 관리자가 자유롭게 만드는 값입니다. `etc`만 미분류/기타 catch-all 용도로 관례적으로 씁니다.

Storage는 FAQ 답변 이미지에만 사용하며, 경로는 `faq-answers/{faqId}/{timestamp}-{파일명}`입니다.

### 필요한 복합 인덱스

채팅 상담 화면이 동작하려면 아래 두 인덱스가 있어야 합니다. 없으면 목록이 비어 보입니다.

- `conversations`: `needsHuman` ASC + `lastMessageAt` DESC
- `conversations/{id}/messages`: `from` ASC + `createdAt` ASC

보안 규칙과 인덱스 정의는 **학생 웹 저장소**(`han-non-e`)의 `firestore.rules` / `firestore.indexes.json`에 있습니다. 수정했다면 그쪽에서 배포해야 적용됩니다.

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 첫 실행

카테고리가 없으면 FAQ·공지·체크리스트 편집기의 카테고리 선택이 비어 있어 저장할 수 없습니다. **카테고리를 먼저 등록**한 뒤 나머지 콘텐츠를 넣으세요.
