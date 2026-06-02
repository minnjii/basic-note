<div align="center">

# 📝 basic note — 설치 가이드

**본인의 Vercel + Supabase 계정에 설치하여, 데이터를 직접 소유하고 운용하는 셀프호스팅 노트 앱**

운영자 없이 각자 자기 서버에서 동작합니다.

<br/>

![소요시간](https://img.shields.io/badge/소요시간-약_10분-3ECF8E?style=flat-square)
![비용](https://img.shields.io/badge/비용-무료_플랜으로_충분-000000?style=flat-square)
![신용카드](https://img.shields.io/badge/신용카드-불필요-blue?style=flat-square)
![암호화](https://img.shields.io/badge/암호화-AES--256--GCM-success?style=flat-square)

</div>

---

> [!NOTE]
> **🔒 데이터 소유 모델**
>
> 모든 노트는 기기에서 **AES-256-GCM으로 암호화된 뒤** Supabase에 저장됩니다.
> 복호화 마스터 키는 사용자가 설정한 비밀번호에서 파생되며 **기기를 떠나지 않습니다.**
> 서버(본인 Supabase)에도 암호문만 저장되므로, DB를 직접 열어도 평문 노트는 보이지 않습니다.

---

## 📋 준비물

| | 항목 | 비고 |
|:---:|------|------|
| 🟢 | [Supabase](https://supabase.com) 계정 | GitHub 로그인 가능 |
| ▲ | [Vercel](https://vercel.com) 계정 | GitHub 로그인 가능 |
| 🐙 | GitHub 계정 | |

---

## 🗄️ 1단계 — Supabase 프로젝트 만들기

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. 아래 항목을 정하고 생성합니다. 프로비저닝에 1~2분 걸립니다.

   | 입력 | 권장값 |
   |------|--------|
   | 이름 | `basic-note` |
   | DB 비밀번호 | 자동 생성 권장 |
   | 리전 | 가까운 곳 (한국이면 `Northeast Asia (Seoul)`) |

### 1-2. 스키마 SQL 실행

1. 좌측 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 [`supabase/setup.sql`](./supabase/setup.sql) **파일 전체**를 복사해 붙여넣습니다.
3. **Run** 클릭 → `Success. No rows returned`이 뜨면 완료입니다.

> [!TIP]
> 테이블 2개(`encrypted_entities`, `app_settings`) + RLS 정책 + Realtime 설정이 한 번에 들어갑니다.
> **여러 번 실행해도 안전합니다(멱등)** — 같은 SQL을 다시 돌려도 한 번 돌린 것과 결과가 같습니다.

### 1-3. API 값 확보

배포에 필요한 값은 **Project URL**과 **anon public key** 두 가지입니다. 아래 순서대로 찾으세요.

<details open>
<summary><b>① Project URL 복사</b></summary>

<br/>

1. 좌측 메뉴 맨 위 **Project Overview**(또는 **Home**) 페이지로 이동
2. 화면 **상단의 프로젝트 이름(타이틀) 바로 아래**에 `https://xxxx.supabase.co` 형태의 주소가 보입니다.
3. 옆의 복사 버튼으로 복사하세요 → 이게 **Project URL**, 곧 `NEXT_PUBLIC_SUPABASE_URL` 입니다.

</details>

<details open>
<summary><b>② anon public key 복사</b> — 일반인이 가장 헤매는 부분 🧭</summary>

<br/>

> [!IMPORTANT]
> Supabase가 최근 키 체계를 바꾸면서, 우리가 쓰는 키는 **"Legacy"** 쪽으로 옮겨졌습니다.
> 새로 보이는 `publishable` / `secret` 키가 아니라 **Legacy anon 키**를 써야 합니다.

1. **Project Settings**(⚙️) → 좌측 메뉴에서 **API Keys** 클릭
2. 화면 **상단에 탭 두 개**가 보입니다:
   - 첫 번째 탭 — `API keys` *(새 방식: publishable / secret)*
   - 두 번째 탭 — **`Legacy API Keys`** ← **여기를 클릭** *(이름에 **anon** · **Legacy**가 들어간 탭)*
3. Legacy 탭에 키 두 개가 나옵니다:
   - ✅ **`anon public`** ← **이걸 복사** (👁️ 또는 **Copy** 버튼)
   - ⛔ `service_role` `secret` ← **절대 사용 금지**
4. 복사한 **`anon public`** 키가 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 입니다.

> [!NOTE]
> 탭 이름은 Supabase UI 업데이트에 따라 `Legacy API Keys` / `Legacy anon key` 등으로 조금씩 다를 수 있습니다.
> **"Legacy"가 붙은 탭**을 누르고 **`anon public`** 라벨이 달린 키를 찾으면 됩니다.

</details>

#### 📌 정리

| 항목 | 환경변수 이름 | 어디서 |
|------|--------------|--------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Project Overview → 프로젝트 타이틀 아래 |
| anon public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API Keys → **Legacy** 탭 → `anon public` |

> [!WARNING]
> `service_role` 키는 **절대 사용하지 마세요.** DB 전체 권한을 가진 비밀 키라 노출되면 위험합니다.

---

## 🚀 2단계 — Vercel에 배포하기

아래 버튼을 누르면 이 저장소가 본인 GitHub로 복제되고, 배포 과정에서 환경변수 입력 화면이 나옵니다.

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fplusxdev%2Fbasic-note&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY&envDescription=Supabase%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EC%9D%98%20URL%EA%B3%BC%20anon%20key&envLink=https%3A%2F%2Fgithub.com%2Fplusxdev%2Fbasic-note%2Fblob%2Fmain%2FSETUP.md&project-name=basic-note&repository-name=basic-note)

</div>

배포 마법사에서:

1. **Create Git Repository** — 본인 GitHub에 복제본을 만듭니다.
2. **Environment Variables** — 1-3에서 복사한 두 값을 붙여넣습니다.
3. **Deploy** 클릭 → 1~2분 후 배포 완료 🎉

> [!CAUTION]
> **값 끝에 공백이나 줄바꿈이 들어가지 않게** 하세요.
> URL 끝에 개행이 붙으면 Realtime 연결이 무한 재시도에 빠질 수 있습니다.
> (앱에 1차 방어가 있지만, 입력 단계에서 깨끗하게 넣는 게 안전합니다.)

> [!NOTE]
> `NEXT_PUBLIC_ENABLE_SYNC`는 넣지 않아도 됩니다. prod 배포에서는 동기화가 자동으로 켜집니다.

---

## ✅ 3단계 — 첫 실행 검증

1. 배포된 URL(`https://<프로젝트>.vercel.app`) 접속
2. **첫 진입 시 비밀번호 설정 화면**이 떠야 정상입니다. 여기서 정한 비밀번호로 마스터 키가 만들어집니다.
3. 노트를 하나 만들고, **다른 기기/브라우저**에서 같은 URL + 같은 비밀번호로 접속해 동기화를 확인합니다.
4. *(선택)* 홈 화면에 추가하면 PWA 앱처럼 설치됩니다.

> [!IMPORTANT]
> 🔑 **복구 키를 반드시 안전한 곳에 백업하세요.**
> 비밀번호를 잊으면 복구 키 없이는 데이터를 절대 되살릴 수 없습니다 (서버에도 평문이 없습니다).

<div align="center">

**🎉 검증 완료 — 이제 본인 데이터로 동작하는 basic note가 준비됐습니다.**

</div>

---

## 🛠️ 트러블슈팅

| 증상 | 원인 / 해결 |
|------|------------|
| 노트가 다른 기기에 안 보임 | Realtime 미설정. `supabase/setup.sql`을 다시 실행하세요 (Realtime 블록 포함). |
| 콘솔에 `%0A` 포함 WebSocket 재연결 반복 | 환경변수 값 끝에 줄바꿈이 들어감. Vercel → Settings → Environment Variables에서 두 값을 공백 없이 다시 저장 후 재배포. |
| "복호화 실패" 항목이 보임 | 다른 마스터 키로 암호화된 데이터가 섞임. 보통 dev/prod가 같은 Supabase를 공유할 때 발생. 개발용 Supabase를 분리하세요. |
| 첫 화면에 비밀번호 설정이 아니라 잠금/복구 화면이 뜸 | 해당 Supabase에 이미 다른 비밀번호로 만든 데이터가 있습니다. 그 비밀번호로 unlock하거나, 설정에서 전체 초기화 후 다시 시작하세요. |
| 빌드 실패 | Node 18+ 필요. Vercel은 기본 충족. 로컬이면 `node -v` 확인. |

> [!TIP]
> 문제가 계속되면 Supabase **Logs**와 브라우저 **DevTools 콘솔**을 함께 확인하세요.

<div align="center">
<sub>© 2026 PlusX basic note</sub>
</div>
