# basic note

기기에서 **AES-256-GCM으로 암호화**한 뒤에만 저장하는, 프라이버시 우선 노트 앱. 서버(본인 Supabase)에는 암호문만 들어가고 복호화 키는 기기를 떠나지 않습니다. PWA로 설치해 오프라인에서도 쓸 수 있습니다.

- 🔒 E2E 암호화 — 서버 운영자도 평문을 볼 수 없음
- ☁️ 본인 Supabase + Vercel에 셀프호스팅 — 데이터 100% 본인 소유
- 📱 PWA — 홈 화면 설치, 오프라인 동작, 멀티 기기 동기화
- ⚡ Next.js (App Router) · TypeScript · Tailwind v4

---

## 설치 (셀프호스팅)

본인 계정에 직접 띄우는 전체 절차는 **[SETUP.md](./SETUP.md)** 에 있습니다 (약 10분, 무료 플랜).

원클릭 배포:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fplusxdev%2Fpro-03-note&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY&envDescription=Supabase%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EC%9D%98%20URL%EA%B3%BC%20anon%20key&envLink=https%3A%2F%2Fgithub.com%2Fplusxdev%2Fpro-03-note%2Fblob%2Fmain%2FSETUP.md&project-name=basic-note&repository-name=basic-note)

> 배포 전에 Supabase 프로젝트를 만들고 `supabase/setup.sql`을 실행해야 합니다. 순서와 환경변수는 [SETUP.md](./SETUP.md) 참고.

---

## 로컬 개발

```bash
git clone https://github.com/<본인>/basic-note.git
cd basic-note
npm install
cp .env.example .env.local   # .env.local에 본인 Supabase 값 입력
npm run dev
```

자세한 내용과 동기화 동작은 [SETUP.md](./SETUP.md)의 "로컬에서 개발하기"를 참고하세요.

## 기술 스택

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Dexie(IndexedDB) · [@plus-experience/design-system](https://www.npmjs.com/package/@plus-experience/design-system)
