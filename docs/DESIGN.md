# 문무니(Munmuni) 관리자 콘솔 디자인 가이드

강남대학교 학사 안내 서비스 **문무니**의 **관리자 데스크톱 앱**(Tauri + React) UI 디자인 시스템 문서입니다.
브랜드 마스코트(양 "문무니")를 중심으로 한 **따뜻한 테라코타·크림 팔레트**, 부드러운 라운드, 절제된 그림자를 기본 언어로 사용합니다. 학생용 웹과 브랜드 톤을 공유합니다.

> 모든 스타일 토큰과 컴포넌트 스타일은 순수 CSS 파일 [`src/styles.css`](../src/styles.css)에 정의되어 있습니다(CSS Module 아님).
> 화면/컴포넌트 구조는 [`src/App.tsx`](../src/App.tsx) 한 파일에 모여 있습니다.

---

## 1. 디자인 원칙

1. **따뜻하고 친근하게** — 딱딱한 행정 도구가 아니라, 마스코트가 함께하는 다정한 톤.
2. **플랫 2D** — 유광 그라데이션·과한 입체 그림자를 지양하고, 단색 면 + 얇은 테두리로 표현.
3. **정보가 눈에 잘 띄게** — 흐린 회색 박스 나열 대신, 강조색 배지·구분선·hover 하이라이트로 위계를 만든다.
4. **상태가 분명하게** — 현재 위치(사이드바 active), hover, 선택/편집 중 상태를 항상 색으로 드러낸다.
5. **일관된 라운드와 여백** — 정해진 radius/shadow/transition 토큰만 사용해 화면 전체가 하나의 시스템으로 읽히게.

---

## 2. 디자인 토큰

모두 [`src/styles.css`](../src/styles.css)의 `:root` CSS 변수로 정의됩니다.

### 2.1 색상

| 토큰               | 값        | 용도                                       |
| ------------------ | --------- | ------------------------------------------ |
| `--bg`             | `#faf5ef` | 페이지 배경(크림)                          |
| `--surface`        | `#ffffff` | 카드·패널·입력 표면                        |
| `--surface-muted`  | `#fbf6f0` | 표 헤더·막대 트랙·보조 표면                |
| `--text`           | `#2b241e` | 본문 텍스트(에스프레소)                    |
| `--muted`          | `#857567` | 보조 텍스트·메타 정보                      |
| `--border`         | `#ece2d6` | 테두리·구분선                              |
| `--border-strong`  | `#ddccbb` | 입력·버튼 등 또렷한 테두리                 |
| `--primary`        | `#b0491f` | 주요 액션·링크·선택 상태(테라코타)         |
| `--primary-hover`  | `#8f3a17` | primary hover                              |
| `--accent`         | `#e08a3c` | 포인트(주황)·아이콘·막대 그라데이션        |
| `--accent-soft`    | `#fbeede` | 강조 배경(배지·아바타 원·hover 하이라이트) |
| `--danger`         | `#b4341f` | 삭제·오류                                  |
| `--danger-soft`    | `#fbe3de` | 오류 배너·pending 배지 배경                |
| `--ok`             | `#2f7d4f` | 성공 토스트·answered 배지                  |
| `--ok-soft`        | `#e0f2e6` | answered 배지 배경                         |

**색 사용 규칙**

- **Primary(테라코타)**: 주 버튼, 링크, 사이드바 현재 페이지, 선택/편집 상태, hover 강조 텍스트.
- **Accent(주황)**: 마스코트 아바타 원, 아이콘 hover, 통계 막대·순위 마커.
- **Accent-soft**: 튀지 않는 "칠해진 강조" — 배지 배경, 아이콘 원, 리스트/표 hover 배경.
- 선택 텍스트 하이라이트: `rgba(176, 73, 31, 0.18)`.
- 포커스 링: `2px solid var(--primary)` (`:focus-visible`), 폼 요소는 `0 0 0 3px rgba(176,73,31,.12)`.

### 2.2 라운드(Radius)

| 토큰          | 값      | 용도                                    |
| ------------- | ------- | --------------------------------------- |
| `--radius-sm` | `8px`   | 버튼·입력·배지                          |
| `--radius-md` | `12px`  | 표·리스트 항목·채팅 목록 카드·토스트    |
| `--radius-lg` | `18px`  | 큰 카드(통계·패널)·로그인 패널·채팅 영역 |
| (pill)        | `999px` | 탭·상태 배지·아바타·아이콘 원           |

### 2.3 그림자(Shadow)

| 토큰          | 값                                     | 용도                    |
| ------------- | -------------------------------------- | ----------------------- |
| `--shadow-sm` | `0 1px 2px rgba(87,62,38,.06)`         | 카드·패널 기본          |
| `--shadow-md` | `0 12px 28px -14px rgba(87,62,38,.28)` | 로그인 패널·토스트·강조 |

> 그림자는 **깊이를 살짝 암시하는 정도**로만. 아이콘·말풍선 등 작은 요소에 유광/입체 그림자를 넣지 않습니다(플랫 2D 원칙).

### 2.4 모션

- 표준 트랜지션: `--transition: 160ms ease` (배경·테두리·색 전환 위주).
- 버튼 클릭: `transform: translateY(1px)`. 토스트 등장: 8px 슬라이드 + 페이드.
- 과한 scale·bounce는 지양.

### 2.5 타이포그래피

- 폰트: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- 렌더링: `text-rendering: optimizeLegibility`, `-webkit-font-smoothing: antialiased`, 기본 `line-height: 1.5`.
- 굵기: 본문 `600`, 강조/제목 `700~800`.
- 제목은 음수 자간(`letter-spacing: -0.015em ~ -0.02em`)으로 또렷하게.
- 콘텐츠 좌우 패딩 등 일부 값은 `clamp()`로 반응형 처리.

---

## 3. 레이아웃

- **앱 셸(`.app`)**: `grid-template-columns: 244px 1fr` — 좌측 사이드바 레일 + 우측 콘텐츠.
- **사이드바(`.sidebar`)**: 깊은 에스프레소 브라운(`#2b241e`), 상단 마스코트 브랜드 → 네비게이션 → 하단 로그아웃. `sticky`, 전체 높이.
- **콘텐츠(`.content`)**: 크림 배경, 패딩 `32px clamp(20px, 3vw, 40px)`.
- **패널(`.panel`)·통계 카드(`.stats article`)**: surface + `--radius-lg` + `--shadow-sm`.
- **2단 통계(`.twoColumnStats`)**: 2열 그리드, 좁은 화면에서 1단.

### 반응형 브레이크포인트

| 폭         | 주요 변화                                                           |
| ---------- | ------------------------------------------------------------------- |
| `≤ 860px`  | 사이드바가 상단 가로 바로 전환(네비 가로 스크롤), 2단·채팅 1단      |
| `≤ 760px`  | 로그인 패널 세로 적층, 마스코트 축소, 히어로 타이틀 축소            |

---

## 4. 마스코트(문무니)

- 파일: [`src/assets/munmuni-mascot.png`](../src/assets/munmuni-mascot.png) (크림색 양, 투명 배경).
- **로그인 브랜드 패널**: 테라코타 그라데이션 위에 마스코트(132px)를 좌상단에 배치, 은은한 drop-shadow 허용.
- **사이드바 브랜드**: `accent-soft` 원(40px) 안에 마스코트를 `width:150%`로 확대·`translateY(8%)`로 얼굴 중앙 정렬한 아바타 + "문무니".
- 마스코트는 브랜드 아이덴티티이므로 색을 바꾸거나 찌그러뜨리지 않습니다.

---

## 5. 아이콘

- [`lucide-react`](https://lucide.dev) 라인 아이콘을 사용합니다(얇은 스트로크, `currentColor` 상속).
- 사이드바 네비: 기본 muted, hover 시 accent, active 시 흰색.
- 로그인 헤더 아이콘(`ShieldCheck`)은 `accent-soft` 원 배경 + primary 색.

---

## 6. 컴포넌트 패턴

### 6.1 버튼

- **기본 버튼**: surface + `--border-strong` 테두리, hover 시 primary 테두리·글자.
- **Primary 버튼(`.primary`)**: `--primary` 배경 + 흰 글자, hover 시 `--primary-hover`. 저장·주요 액션.
- **탭(`.tabs button`)**: 알약형(pill), 선택 시 `.active`(primary 배경, 흰 글자). 좁은 화면 가로 스크롤.
- 클릭 시 `translateY(1px)`로 눌리는 피드백.

### 6.2 카드 / 패널

- **통계 카드(`.stats article`)**: 큰 숫자(`strong`, 32px) + 라벨(muted). surface + `--radius-lg` + `--shadow-sm`.
- **패널(`.panel`)**: 섹션 컨테이너. 제목 `h2`(17px) + 내용.

### 6.3 리스트 (구분선 스타일)

박스 나열 대신 **구분선 + hover 하이라이트**를 표준으로 씁니다.

- **편집 리스트(`.list`)**: 상단/항목 하단 보더로 행 구분, `[선택 버튼 | 삭제]`. hover 시 `accent-soft` 배경, 선택 텍스트는 primary. 삭제 버튼은 평소 테두리 없이 muted, hover 시 danger.
- **편집 중 항목(`.list > div.editing`)**: `accent-soft` 배경 + 좌측 primary 3px 바.
- **순위 리스트(`.rankList`)**: `accent-soft` 원형 번호 마커 + 제목 + primary 수치. 하단 보더로 구분.

### 6.4 표(`table`)

- surface + `--radius-md`, 헤더(`th`)는 `surface-muted` 배경 + 대문자 muted 라벨.
- 행 hover 시 `accent-soft` 배경. 마지막 행 보더 제거.

### 6.5 배지

- **상태 배지(`mark.pending / mark.answered`)**: pending=`danger-soft`/danger, answered=`ok-soft`/ok. 알약형.

### 6.6 폼

- 입력(`input/textarea/select`): surface + `--border-strong` + `--radius-sm`, 포커스 시 primary 보더 + soft 링.
- **체크박스(`.check`)**: `accent-color: primary`.
- **필드셋(`fieldset`/`legend`)**: 관련 옵션 묶음(관련 공지, 첨부 이미지, 연결 카테고리 등).
- **이미지 썸네일(`.imageThumb`)**: 72px 라운드 썸네일 + 우상단 danger 원형 삭제 버튼.

### 6.7 피드백

- **토스트(`.toast`)**: 우하단, success=`ok`/error=`danger` 배경 + 흰 글자, 슬라이드-인.
- **동기화 바(`.syncBar`)**: 상단 중앙 고정 primary 바("동기화 중…").
- **오류 배너(`.notice`)**: `danger-soft` 배경 + danger 글자.

---

## 7. 로그인 화면

- **좌측 브랜드 패널(`.loginBrand`)**: 테라코타 세로 그라데이션 + 마스코트 + "관리자 콘솔 / 문무니 / 설명".
- **우측 폼 패널(`.loginForm`)**: `ShieldCheck` 헤더 + 비밀번호 입력(아이콘 인셋, `:focus-within` 강조) + primary "문무니 시작하기".
- 좁은 화면에서 상하로 적층됩니다.

---

## 8. 채팅 상담 (`/chat`)

- **레이아웃(`.chatConsole`)**: `300px` 대화 목록 + 대화 스레드 2단(좁은 화면 1단).
- **대화 목록(`.chatList`)**: surface 카드, 선택 시 primary 테두리 + 링. 학번/이름·미리보기·시각.
- **메시지 영역(`.chatMessages`)**: surface + 은은한 우상단 accent 방사형 그라데이션.
  - 학생 → 좌측(`--surface-muted` 말풍선 + 보더).
  - 관리자 → 우측(primary 배경 + 흰 글자).
  - AI/자동응답(`bot`/`ai`) → 좌측(`accent-soft` 배경 + 주황 보더).
  - 발신자 라벨(`.who`)은 소형 대문자 태그.
- **답장 바(`.chatReply`)**: 입력 + primary "보내기".

---

## 9. 접근성

- 색 대비: 본문/보조 텍스트는 크림·surface 배경 위에서 충분한 대비 유지.
- 포커스: `:focus-visible`로 키보드 포커스 링 노출.
- 아이콘 전용 버튼에는 `aria-label`, 장식 이미지·아이콘에는 `alt=""`/`aria-hidden`.
- 상태 배지 등 색으로만 구분되는 정보는 텍스트 라벨을 함께 제공.
- 토스트 영역은 `aria-live="polite"`.

---

## 10. 사용 가이드(요약)

- ✅ 정의된 토큰(color/radius/shadow/transition)만 사용한다.
- ✅ 리스트·표는 구분선 + hover 하이라이트, 강조는 accent 계열로.
- ✅ 현재 위치·선택·편집 등 상태를 항상 색으로 드러낸다.
- ✅ 아이콘·작은 요소는 플랫 2D 유지.
- ❌ 유광 그라데이션, 과한 입체/유광 그림자, 임의의 색·라운드 값.
- ❌ 마스코트 변형(색 변경, 비율 왜곡).
