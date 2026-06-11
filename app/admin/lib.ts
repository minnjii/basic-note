import pkg from "../../package.json";

// Admin tracking data layer.
//
// Two layers per installer (see CLAUDE_HISTORY 2026-06-09 lesson
// "fork 동기화됨 ≠ 라이브 갱신됨"):
//   1. CODE   — does the fork's main branch have origin's latest commits?
//               (GitHub compare API → ahead_by; merge-synced forks carry
//                merge-commit SHAs so a raw SHA equality check is useless)
//   2. LIVE   — is the deployed app actually serving the new release?
//               (the installer's /api/version → semver, which is fork-stable)
//
// Everything here runs server-side on the ORIGIN deploy only. Forks lack the
// ADMIN_* env so the page never reaches this code (see page.tsx guard).

const ORIGIN_OWNER = "plusxdev";
const REPO = "basic-note";

export const ORIGIN_SEMVER = pkg.version;

export type InstallerStatus =
  | "up-to-date" // code synced + live serving current semver
  | "live-stale" // code synced but live still on old semver (Preview 갇힘 / Promote 필요 / 빌드중)
  | "unreachable" // domain registered but /api/version fetch failed
  | "no-domain" // code synced, but no live domain registered to verify
  | "code-behind"; // fork main is behind origin (Pull 미설치 / 동기화 멈춤)

export type InstallerRow = {
  owner: string;
  repo: string;
  pushedAt: string | null;
  aheadBy: number | null; // commits origin is ahead of this fork; null = compare failed
  domain: string | null;
  liveSemver: string | null;
  liveSha: string | null;
  status: InstallerStatus;
};

export type TrackingResult = {
  originSemver: string;
  originSha: string;
  rows: InstallerRow[];
  error: string | null;
};

async function gh(path: string) {
  const token = process.env.ADMIN_GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GitHub ${path} → ${res.status}`);
  }
  return res.json();
}

// "minnjii=basic-note-xi.vercel.app, szuxxszu=foo.vercel.app"
// key = fork owner login, value = live domain (with or without scheme)
function parseDomains(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const [label, domain] = pair.split("=");
    if (label?.trim() && domain?.trim()) {
      map.set(label.trim().toLowerCase(), domain.trim());
    }
  }
  return map;
}

async function fetchLive(
  domain: string
): Promise<{ version: string | null; semver: string | null } | null> {
  try {
    const base = domain.startsWith("http") ? domain : `https://${domain}`;
    const res = await fetch(`${base}/api/version`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      version: typeof data?.version === "string" ? data.version : null,
      semver: typeof data?.semver === "string" ? data.semver : null,
    };
  } catch {
    return null; // unreachable / timeout
  }
}

function classify(
  aheadBy: number | null,
  domain: string | null,
  live: { semver: string | null } | null,
  originSemver: string
): InstallerStatus {
  if (aheadBy === null) return "code-behind"; // compare failed → treat as unknown/behind
  if (aheadBy > 0) return "code-behind";
  if (!domain) return "no-domain";
  if (!live) return "unreachable";
  if (live.semver && live.semver === originSemver) return "up-to-date";
  return "live-stale";
}

// A fork's `homepage` (GitHub About → Website) is our zero-infra auto-discovery
// channel: installers set it to their live URL per SETUP, and we read it free
// via the forks API. BUT every fork inherits origin's homepage verbatim at fork
// time, so an untouched fork carries that stale value — we must ignore it and
// only trust a homepage the installer actually changed (≠ origin's).
function autoDomain(
  homepage: string | null | undefined,
  originHomepage: string | null
): string | null {
  if (!homepage) return null;
  if (originHomepage && homepage === originHomepage) return null; // inherited, not set
  return homepage;
}

export async function loadTracking(): Promise<TrackingResult> {
  const originSemver = ORIGIN_SEMVER;
  try {
    const [originCommit, originRepo] = await Promise.all([
      gh(`/repos/${ORIGIN_OWNER}/${REPO}/commits/main`),
      gh(`/repos/${ORIGIN_OWNER}/${REPO}`),
    ]);
    const originSha: string = originCommit.sha;
    const originHomepage: string | null = originRepo?.homepage || null;

    const forks: Array<{
      name: string;
      pushed_at: string;
      homepage: string | null;
      owner: { login: string };
    }> = await gh(`/repos/${ORIGIN_OWNER}/${REPO}/forks?per_page=100&sort=newest`);

    const domains = parseDomains(process.env.ADMIN_INSTALLER_DOMAINS);

    const rows = await Promise.all(
      forks.map(async (fork): Promise<InstallerRow> => {
        const owner = fork.owner.login;
        // env registration wins (manual override / correction); otherwise fall
        // back to the installer-set repo homepage.
        const domain =
          domains.get(owner.toLowerCase()) ??
          autoDomain(fork.homepage, originHomepage);

        // ahead_by = commits origin(head) is ahead of the fork(base) = what the
        // fork still needs to pull. base=fork:main, head=origin main.
        let aheadBy: number | null = null;
        try {
          const cmp = await gh(
            `/repos/${ORIGIN_OWNER}/${REPO}/compare/${owner}:main...main`
          );
          aheadBy = typeof cmp?.ahead_by === "number" ? cmp.ahead_by : null;
        } catch {
          aheadBy = null;
        }

        const live = domain ? await fetchLive(domain) : null;

        return {
          owner,
          repo: fork.name,
          pushedAt: fork.pushed_at ?? null,
          aheadBy,
          domain,
          liveSemver: live?.semver ?? null,
          liveSha: live?.version ?? null,
          status: classify(aheadBy, domain, live, originSemver),
        };
      })
    );

    // Behind-most first, then alphabetical — surfaces problems at the top.
    const order: Record<InstallerStatus, number> = {
      "code-behind": 0,
      unreachable: 1,
      "live-stale": 2,
      "no-domain": 3,
      "up-to-date": 4,
    };
    rows.sort(
      (a, b) =>
        order[a.status] - order[b.status] || a.owner.localeCompare(b.owner)
    );

    return { originSemver, originSha, rows, error: null };
  } catch (e) {
    return {
      originSemver,
      originSha: "",
      rows: [],
      error: e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.",
    };
  }
}
