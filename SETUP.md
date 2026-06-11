# 📝 basic note — 설치 가이드

**본인의 Vercel + Supabase 계정에 설치하여, 데이터를 직접 소유하고 운용하는 셀프호스팅 노트 앱**

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
> 테이블 2개(`encrypted_entities`, `app_settings`) + RLS 정책 + Realtime 설정이 한 번에 들어갑니다. 같은 SQL을 다시 돌려도 한 번 돌린 것과 결과가 같습니다.

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

## 🚀 2단계 — Fork & Vercel 배포

> [!IMPORTANT]
> **꼭 "Fork"로 설치하세요.** 단순 복제가 아니라 Fork로 깔아야 이후 **자동 업데이트**(원본의 새 버전이 자동으로 흘러들어옴)가 동작합니다. (4단계 참고)

### 2-1. GitHub에서 코드 복제(Fork)

> 여기서부터는 **방금까지 보던 Supabase가 아니라 [GitHub](https://github.com)** 라는 다른 사이트입니다. GitHub은 앱의 *코드*가 보관된 곳이고, "저장소(repository)"는 그 코드가 담긴 폴더라고 보면 됩니다. "Fork"는 그 폴더를 **내 GitHub 계정으로 복사**해 오는 것입니다.

1. (GitHub 계정이 없으면) [github.com](https://github.com)에서 무료 가입 후 로그인
2. 아래 링크를 누르면 복사(Fork) 화면이 열립니다 →  **[basic note 저장소 Fork하기](https://github.com/plusxdev/basic-note/fork)**
3. 나오는 화면에서 **다른 건 그대로 두고** 아래 초록색 **`Create fork`** 버튼만 클릭
4. 잠시 뒤 주소창이 `github.com/<본인아이디>/basic-note` 로 바뀌면 = 내 계정으로 복사 완료

### 2-2. Vercel에 배포

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** 에서 방금 만든 본인 **Fork**(`<본인>/basic-note`)를 선택
2. **Environment Variables** 에 1-3에서 복사한 두 값을 입력:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | (Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon public 키) |

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

**🎉 검증 완료 — 이제 본인 데이터로 동작하는 basic note가 준비됐습니다.**

### 3-2. Fork에 라이브 주소 기록하기

**"새 버전이 본인 배포에 잘 반영됐는지"를 확인**하고, 뒤처지면 도와줄 수 있게 하는 단계입니다.

1. 본인 GitHub Fork 저장소(`github.com/<본인>/basic-note`) 페이지로 이동
2. 우측 상단 **About** 옆 **⚙️(톱니)** 클릭
3. **Website** 칸에 본인 배포 주소(`https://<프로젝트>.vercel.app`)를 입력 → **Save changes**

---

## 🔄 4단계 — 자동 업데이트 켜기 (한 번만)

원본(basic note)에 새 버전이 나오면 **본인 Fork가 자동으로 따라가고, 사용자는 손댈 게 없게** 만드는 단계입니다. 한 번만 설정하면 끝입니다.

1. [github.com/apps/pull](https://github.com/apps/pull) 접속 → **Install**
2. 방금 만든 본인 **Fork(`<본인>/basic-note`)** 를 선택해 설치
3. **Vercel → 본인 프로젝트 → Settings → Security → `Git Fork Protection` 끄기(Disable)**

> [!IMPORTANT]
> **3번은 꼭 해야 합니다.** Pull 봇이 동기화하는 커밋의 작성자는 원본 제작자(= 본인 Vercel 팀 멤버가 아님)이기 때문에, Vercel이 기본적으로 그 배포를 **수동 승인 대기(`awaiting authorization`)** 로 막습니다. 끄지 않으면 코드는 Fork에 들어와도 **웹 배포가 갱신되지 않습니다.**
>
> 이 앱은 끄는 게 안전합니다 — 보호 대상인 환경변수 2개가 모두 `NEXT_PUBLIC_` 접두사라 **어차피 브라우저에 공개되는 값**이고(시크릿 아님), 실제 보안은 E2E 암호화 + RLS로 지킵니다.

이게 전부입니다. 이제 업데이트는 이렇게 흐릅니다:

```
원본에 새 버전 push
  → (Pull 봇이) 본인 Fork에 자동 동기화
  → Vercel이 자동 재배포
  → 사용자 브라우저: 진입 시 "업데이트 중" 화면 / 사용 중엔 "새 버전" 배너 → 끝
```

- **재설치·재로그인 불필요**, 데이터는 기기 로컬(IndexedDB)에 있어 그대로 보존됩니다.
- 사용자가 업데이트를 받으려면 **온라인 1회 접속**만 필요하고, 이후 오프라인에서도 정상 동작합니다.

> [!WARNING]
> **DB 스키마가 바뀌는 릴리스**(드묾)는 코드만 자동 반영되고 테이블 변경은 자동이 아닙니다.
> 그런 릴리스에는 별도 공지로 안내하며, [`supabase/setup.sql`](./supabase/setup.sql)을 **다시 실행**하면 됩니다(멱등이라 안전).

> [!NOTE]
> Pull 봇은 원본의 새 변경분을 본인 Fork에 **자동으로 합쳐(merge)** 항상 최신 코드와 동일한 내용으로 유지합니다.
> **Fork의 코드를 직접 수정하지 마세요** — 코드를 건드리면 원본과 충돌이 나 자동 동기화가 멈출 수 있습니다. 설정값은 코드가 아니라 Vercel 환경변수에 두면 됩니다.

---

## 🛠️ 트러블슈팅

| 증상 | 원인 / 해결 |
|------|------------|
| 노트가 다른 기기에 안 보임 | Realtime 미설정. `supabase/setup.sql`을 다시 실행하세요 (Realtime 블록 포함). |
| 콘솔에 `%0A` 포함 WebSocket 재연결 반복 | 환경변수 값 끝에 줄바꿈이 들어감. Vercel → Settings → Environment Variables에서 두 값을 공백 없이 다시 저장 후 재배포. |
| "복호화 실패" 항목이 보임 | 다른 마스터 키로 암호화된 데이터가 섞임. 보통 dev/prod가 같은 Supabase를 공유할 때 발생. 개발용 Supabase를 분리하세요. |
| 첫 화면에 비밀번호 설정이 아니라 잠금/복구 화면이 뜸 | 해당 Supabase에 이미 다른 비밀번호로 만든 데이터가 있습니다. 그 비밀번호로 unlock하거나, 설정에서 전체 초기화 후 다시 시작하세요. |
| GitHub Fork는 최신인데 웹 앱이 옛 버전 그대로 / 배포가 `awaiting authorization` | **Git Fork Protection**이 켜져 있어 Pull 봇 동기화 커밋의 배포가 막힌 것. **Settings → Security → `Git Fork Protection` 끄기**(4단계 3번). 이미 막힌 배포는 Vercel **Deployments → Create Deployment → `main`** 으로 한 번 올리거나, 막힌 배포의 **Authorize** 버튼을 누르면 해제됩니다. |
| Fork·빌드는 최신인데 라이브만 옛 버전 / 최신 배포가 **`Production`**이 아니라 **`Preview`** 로만 떠 있음 | 그 커밋이 본배포로 승격되지 않은 상태. **Vercel → Deployments → 최신 배포 행 우측 `⋯` → `Promote to Production`** 한 번이면 즉시 라이브에 반영됩니다(재빌드 아님). 옛 버전 Fork에서 한 번 나타날 수 있고, 이후 동기화부터는 자동으로 Production에 올라갑니다. |
| 오프라인에서 노트 진입/생성이 안 됨 (새 배포 직후) | 새 버전 코드를 아직 못 받은 상태. **온라인에서 앱을 한 번 열면** 서비스워커가 새 버전을 받아 캐시하며, 이후 오프라인에서 정상 동작합니다. |
| 빌드 실패 | Node 18+ 필요. Vercel은 기본 충족. 로컬이면 `node -v` 확인. |

> [!TIP]
> 문제가 계속되면 Supabase **Logs**와 브라우저 **DevTools 콘솔**을 함께 확인하세요.

<sub>© 2026 PlusX basic note</sub>
