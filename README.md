# 한논이 관리자

Tauri 2, React, TypeScript로 만든 한논이 데스크톱 관리자 콘솔입니다. Firebase Auth로 관리자 로그인을 처리하고, Firestore와 Storage에 저장된 상담/공지/FAQ 데이터를 관리합니다.

## 주요 기능

- 운영 통계: 전체 문의 수, 채팅/전화 문의 수, 카테고리별 문의 분포, 조회수 상위 FAQ/공지 확인
- 채팅 상담: 학생 대화 목록 실시간 구독, 관리자 답장 전송, 관리자 미확인 표시 해제
- 전화 문의 기록: 카테고리와 예시 질문을 선택하거나 직접 입력해서 전화 문의 저장
- 콘텐츠 관리: 카테고리, FAQ, 학교 공지, 체크리스트 등록/수정/삭제
- FAQ 이미지 업로드: Firebase Storage에 답변 이미지를 업로드하고 다운로드 URL 저장

## 기술 스택

- Tauri 2
- React 18
- TypeScript
- Vite
- Firebase Auth, Firestore, Storage

## 사전 준비

- Node.js와 npm
- Rust 및 Tauri 빌드 환경
- Firebase 프로젝트
  - Email/Password 로그인 활성화
  - 관리자 이메일 계정 생성
  - Firestore 및 Storage 사용 설정

## 환경변수

`.env.example`을 `.env`로 복사한 뒤 Firebase 웹 앱 설정값을 입력합니다.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ADMIN_LOGIN_EMAIL=admin@han-non-e.internal
```

로그인 화면에는 비밀번호만 입력합니다. 이메일은 `VITE_ADMIN_LOGIN_EMAIL` 값을 사용하며, 비밀번호는 Firebase Auth에 등록된 해당 계정의 비밀번호입니다.

## 실행

```bash
npm install
npm run tauri:dev
```

프론트엔드만 확인할 때는 다음 명령을 사용할 수 있습니다.

```bash
npm run dev
```

## 빌드

```bash
npm run build
npm run tauri:build
```

Tauri 실행 파일은 기본적으로 `src-tauri\target\release\han-non-e-admin.exe`에 생성됩니다. 현재 Tauri 번들러 설정은 비활성화되어 있어 MSI/설치 패키지는 만들지 않습니다.

## Firestore 컬렉션

앱은 다음 컬렉션을 사용합니다.

- `categories`: 상담 카테고리
- `keywordPresets`: 전화 문의 예시 질문
- `notices`: 학교 공지 링크
- `faqEntries`: FAQ와 답변, 첨부 이미지 URL
- `checklists`: 카테고리별 체크리스트
- `inquiries`: 채팅/전화 문의 기록
- `conversations`: 학생별 채팅 대화 및 하위 `messages`

초기 실행 시 카테고리와 기본 데이터가 없으면 화면이 비어 보일 수 있습니다. Firebase에 필요한 seed 데이터를 먼저 넣은 뒤 실행하세요.
