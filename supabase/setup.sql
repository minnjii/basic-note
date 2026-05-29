-- ============================================================================
-- basic note — Supabase 초기 설정 SQL
-- ----------------------------------------------------------------------------
-- 새 Supabase 프로젝트의 SQL Editor에 이 파일 전체를 붙여넣고 한 번 실행하세요.
-- 여러 번 실행해도 안전합니다(멱등). 자세한 절차는 루트의 SETUP.md 참고.
--
-- 데이터 모델 요약:
--   이 앱은 Supabase Auth를 쓰지 않습니다. 모든 노트/설정은 클라이언트에서
--   AES-256-GCM으로 암호화된 뒤 저장되므로, 서버(이 DB)에는 암호문만 들어갑니다.
--   복호화 키(마스터 키)는 사용자 기기를 떠나지 않습니다.
-- ============================================================================

-- ─── 1. 테이블 ──────────────────────────────────────────────────────────────

-- 노트 / 카테고리 (암호화된 엔티티)
create table if not exists public.encrypted_entities (
  id          text primary key,
  entity_type text    not null,          -- 'note' | 'category'
  data        text    not null,          -- 암호화된 JSON 문자열
  updated_at  bigint  not null,          -- epoch milliseconds
  deleted     boolean not null default false
);

-- 앱 설정 (암호화된 마스터 키 래퍼 등). 보통 id = 'settings' 단일 행
create table if not exists public.app_settings (
  id         text primary key,
  data       text   not null,            -- 암호화된 JSON 문자열
  updated_at bigint not null             -- epoch milliseconds
);

-- 증분 동기화(updated_at 기준 pull)를 위한 인덱스
create index if not exists encrypted_entities_updated_at_idx
  on public.encrypted_entities (updated_at);

-- ─── 2. Row Level Security ──────────────────────────────────────────────────
-- 클라이언트는 공개되는 anon key로 접속합니다. RLS를 켜고 anon에게 두 테이블의
-- 읽기/쓰기/삭제를 명시적으로 허용합니다. 평문 보호는 RLS가 아니라 클라이언트
-- E2E 암호화가 담당합니다(서버는 암호문만 보관).

alter table public.encrypted_entities enable row level security;
alter table public.app_settings       enable row level security;

drop policy if exists "anon full access on encrypted_entities" on public.encrypted_entities;
create policy "anon full access on encrypted_entities"
  on public.encrypted_entities
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "anon full access on app_settings" on public.app_settings;
create policy "anon full access on app_settings"
  on public.app_settings
  for all
  to anon
  using (true)
  with check (true);

-- ─── 3. Realtime ────────────────────────────────────────────────────────────
-- 다른 기기에서 push한 변경을 즉시 받기 위해 두 테이블을 realtime publication에
-- 추가합니다. 이미 추가돼 있으면 조용히 건너뜁니다.

do $$
begin
  alter publication supabase_realtime add table public.encrypted_entities;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_settings;
exception
  when duplicate_object then null;
end $$;

-- 완료. SETUP.md의 다음 단계(Vercel 환경변수 설정)로 진행하세요.
