# 문무니 관리자 앱 — 세션 인계 프롬프트

아래 전체를 복사해서 `C:\Users\USER\Desktop\han-non-e-admin`을 작업 디렉터리로 연 새 Claude Code 세션에 붙여넣으세요.

---

너는 "문무니"(학사 한눈에) 학사 안내 시스템의 **관리자 데스크탑 앱** 작업을 이어서 한다. 이 저장소(`C:\Users\USER\Desktop\han-non-e-admin`)는 Tauri 2 + React + TypeScript + Vite로 만든 관리자 전용 데스크탑 앱이다(git 저장소, master 브랜치). 학생용 웹은 별도 저장소 `C:\Users\USER\Desktop\han-non-e`(React+Vite, git 저장소)에 있고, 두 앱은 **같은 Firebase 프로젝트(Firestore/Storage/Auth)를 공유**한다.

## 저장소 구조 (관리자 앱)

거의 모든 로직이 `src/App.tsx` 한 파일(약 700줄)에 있다:
- `src/App.tsx` — 로그인, 레이아웃(사이드바), 모든 페이지 컴포넌트, 라우팅
- `src/data.ts` — Firestore CRUD 함수 전부(load*, save*, remove*, groupInquiries, 채팅 구독 함수 등)
- `src/types.ts` — 전체 타입 정의
- `src/firebase.ts` — Firebase 초기화, `ADMIN_LOGIN_EMAIL` 상수
- `src/styles.css` — 순수 CSS(모듈 아님), 다크 사이드바 + 라이트 콘텐츠 톤

## 디자인/브랜딩

- 색감은 **파란색 테마**(로고 파랑 `#1668c7`, 어두운 `#0f4e9c`). `src/styles.css`의 CSS 변수 `--primary`/`--primary-dark`/`--accent`와 로그인·사이드바 하드코딩 값이 모두 파랑 계열. (구 초록/주황 테마에서 전환됨)
- 로고는 `src/App.tsx`의 인라인 SVG `Logo` 컴포넌트(두 겹 둥근 사각형, `currentColor` 따라감). 로그인 브랜드 박스 + 사이드바 상단에 사용.
- 앱 아이콘은 `src-tauri/logo.png.png`를 원본으로 `npm run tauri -- icon <경로>` 실행해 `src-tauri/icons/`(icon.ico 등) 생성. 로고 교체 시 이 명령 재실행.

## 인증 방식

화면에는 **비밀번호 입력창 하나만** 있다. 내부적으로는 고정된 Firebase 이메일(`VITE_ADMIN_LOGIN_EMAIL`, 기본값 `admin@han-non-e.internal`)로 `signInWithEmailAndPassword`를 호출한다 — Firebase Authentication 콘솔에 그 이메일 계정을 미리 만들어 비밀번호를 팀과 공유하면 된다. Firestore 규칙의 `isAdmin()`은 `sign_in_provider == 'password'`로 관리자(이메일/비번 로그인)와 학생(익명 로그인)을 구분한다.

## Firestore 컬렉션 (양쪽 앱이 공유)

| 컬렉션 | 주요 필드 | 비고 |
|---|---|---|
| `categories` | id, label, description, phone, hours, order | **카테고리는 완전 데이터 기반**(양쪽 앱 모두 `CategoryId = string`). 관리자 앱에서 자유롭게 추가/수정/삭제하면 학생 웹 새로고침 시 자동 반영됨. `'etc'`만 미분류/기타 catch-all 예약어(홈 칩·상단 탭에서 제외) |
| `keywordPresets` | id, categoryId, label, order | 학생 챗봇 빠른버튼용. **관리자 편집 화면 삭제됨**, 전화기록도 메모형으로 바뀌며 더 이상 presets를 쓰지 않음(관리자 앱 store에는 로드되나 미사용). 데이터/학생 웹 읽기는 유지 |
| `faqEntries` | id, categoryId, question, answer, answerImageUrls[], relatedNoticeIds[], order, pinned, viewCount, updatedAt | 학생 화면 FAQ의 유일한 소스. **채팅/전화 문의에서 자동 생성되지 않음** — 관리자가 FAQ 탭에서 직접 작성하는 "게시물" |
| `checklists` | id, categoryId, order, items:[{id,label,content,order}] | "신청 전 체크리스트" |
| `notices` | id, categoryId, title, url, postedAt, order, viewCount | 원문 공지. `viewCount`는 실제 클릭 기반(세션당 1회) |
| `inquiries` | id(=conversationId for chat), source:'chat'\|'phone', categoryId, keyword, detail, status, createdAt, answeredAt? | **채팅은 대화(conversationId)당 문서 1개만** 생성됨(첫 메시지가 keyword). 전화는 `LogCall`에서 매번 생성 |
| `conversations` + `messages` 서브컬렉션 | studentId, studentName, studentNumber, categoryId, status, lastMessage, lastMessageAt, unreadForAdmin, unreadForStudent, needsHuman, studentMessageCount | 실시간 채팅 상담. 학생이 채팅 시작 전 **학번/이름을 입력**해야 대화가 생성됨. `studentMessageCount`가 0이면(자동 안내 메시지만 있고 학생이 실제로 말 안 함) 관리자 목록에서 숨겨짐 |

## 관리자 앱 라우트/기능 현황

- `/` **Stats**(구 Dashboard) — 전체/채팅/전화 문의 수, FAQ·공지 수, 카테고리별 문의 분포(막대), 많이 묻는 키워드 표(참고용, 클릭 불가), FAQ/공지 조회수 TOP5
- `/chat` **ChatConsole** — 실시간 채팅 상담. 대화 목록에 학번/이름 표시, 빈 대화는 숨김
- `/log-call` **LogCall** — **간단 메모**로 개편됨: 카테고리 선택(드롭다운) + 메모 텍스트 → 저장, 아래에 최근 전화 메모 목록. 여전히 `inquiries`(source: 'phone')에 저장되어 통계에 집계됨
- `/edit/categories` **CategoriesEditor** — **이름만 입력하면 ID 자동 생성**(`cat-<시각>`), 수정/신규 모드 표시, 현재 카테고리 목록 나열, 삭제. 영문 ID는 화면에 노출하지 않음
- `/edit/faqs` **FaqEditor** — 작성/수정/삭제, 순서·대표질문 고정(pinned)·관련 공지 연결·이미지 첨부(Storage 업로드) 전부 가능
- `/edit/notices` **NoticesEditor** — 등록/수정/삭제, 카테고리 필터 탭 + 제목 검색
- `/edit/checklists` **ChecklistEditor** — 카테고리별 항목 라벨/내용 수정·추가·삭제
- ~~`/edit/presets`~~ — **삭제됨**(사용자 요청, "예시 질문 탭은 삭제해도 돼")
- ~~`/answer/:id`~~ — **삭제됨**(FAQ가 문의 로그에서 자동 생성되지 않도록 분리하면서 제거)

## 이번 세션에서 이미 반영한 사용자 피드백 (다시 하지 말 것)

1. FAQ는 채팅/전화 문의와 완전히 분리된 "게시물" — 자동 생성 없음
2. 원문공지 목록에 카테고리 필터 + 제목 검색
3. 체크리스트: 카테고리 select에 라벨 표시, placeholder 추가
4. 예시 질문 관리 탭 삭제(데이터는 유지)
5. 채팅: 학번/이름 입력 후 시작(학생 웹), 관리자 목록에 표시, 빈 대화(자동 안내만 있는 것) 숨김
6. 대시보드 → 통계 페이지로 전면 개편
7. 사이드바 아이콘-라벨 간격 CSS 수정(`.sidebar a`에 `display:flex` 누락이 원인이었음)
8. 채팅 하나 = 문의 하나(메시지마다 문의가 쌓이지 않도록 conversationId를 문서 id로 고정)
9. **파란색 테마 전환 + 로고 SVG + 앱 아이콘 재생성**
10. **카테고리 완전 데이터 기반화**: 양쪽 앱 `CategoryId = string`, 관리자 CategoriesEditor 이름 기반 개편, 전화기록 메모 간소화, seed 배너 제거
11. **학생 웹 동기화 수정**: `isCategoryId` 하드코딩 필터 제거(`src/services/inquiryService.ts`), 상단 탭 동적화(`src/constants.ts`의 `primaryCategories` + `CategoryPage.tsx`), `firestore.rules`의 `inquiries` 생성 규칙 categoryId 게이트를 `is string`으로 완화

## 카테고리 아키텍처 (양쪽 앱 공통, 중요)

카테고리는 **Firestore `categories` 단일 출처**로 완전 데이터 기반이다. 어느 쪽 앱에도 카테고리 목록을 하드코딩하지 않는다.
- 관리자가 추가/수정/삭제 → 학생 웹은 **페이지 로드(새로고침) 시 반영**(실시간 구독 아님 — 카테고리는 자주 안 바뀌므로 의도적)
- `'etc'`는 미분류/기타 catch-all 예약어. 홈 칩(`CategoryChips` `limitToPrimary`)과 상단 탭에서만 제외되고 나머지는 자동으로 정식 탭이 됨
- **⚠️ `firestore.rules` 변경은 배포해야 적용됨**: 학생 웹 저장소에서 `firebase deploy --only firestore:rules`. 미배포 시 새 카테고리로 만든 문의/전화 메모가 규칙에서 거부됨
- 과거에 카테고리를 막던 하드코딩 지점(제거 완료, 재발 방지용 기록): 학생 웹 `isCategoryId`, `primaryTabs`, 양쪽 `CategoryId` union, `firestore.rules`의 categoryId 화이트리스트

## 보류 중(아직 미구현, 사용자가 나중에 하겠다고 함)

- **AI 요약**: "채팅 대화 하나가 여러 메시지로 오갈 텐데, 그걸 AI로 요약해서 쓰면 좋겠다"는 아이디어가 나왔으나 **범위가 불명확해서 보류**함(무엇을 요약할지 — 문의 키워드 대체용인지, 관리자 채팅 목록의 미리보기용인지 — 및 OpenAI 비용 문제 때문에 사용자가 나중에 다시 요청하기로 함). 구현 전에 반드시 범위를 다시 확인할 것.

## 알아둘 것

- **개발 도구로 이 turn을 직접 클릭 테스트할 수 없음** — Tauri는 네이티브 창이라 GUI 인터랙션은 사용자가 `npm run tauri:dev`로 직접 확인해야 함. 빌드/타입체크(`npm run build`)까지만 검증 가능.
- 학생 웹(`han-non-e`) 쪽에서 **동시에 다른 세션/도구가 파일을 건드리는 경우가 있었음**(예: 포맷터, 이전 세션의 잔여 변경) — 파일을 수정하기 전 항상 다시 Read해서 최신 상태를 확인할 것.
- Firestore 시드/초기화 스크립트는 **학생 웹 저장소**(`han-non-e/scripts/seed.mjs`, `han-non-e/scripts/reset.mjs`)에 있다. `npm run reset -- --confirm`으로 전체 삭제, `npm run seed`로 기본 데이터 재입력.
- `firestore.rules`/`storage.rules`도 학생 웹 저장소 루트에 있고, 변경 시 Firebase 콘솔/CLI로 배포해야 실제 적용됨.

## 실행

```bash
npm install
npm run build       # tsc + vite build로 타입체크
npm run tauri:dev    # 개발 실행
npm run tauri:build  # 배포용 빌드 (실행 파일: src-tauri\target\release\han-non-e-admin.exe)
```

먼저 `src/App.tsx`, `src/data.ts`, `src/types.ts`를 다시 읽어서 위 설명과 실제 코드가 일치하는지 확인한 뒤 작업을 시작해라(이 문서 작성 이후 사용자가 직접 수정했을 수 있음).
