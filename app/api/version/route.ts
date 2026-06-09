import { NextResponse } from "next/server";
import pkg from "../../../package.json";

// Always reflects the CURRENTLY deployed build. A client running an older
// bundle will see its baked NEXT_PUBLIC_APP_VERSION differ from this and
// trigger the in-app update flow. Must never be cached.
//
// Two fields, on purpose:
// - version = commit SHA → drives update detection (changes every deploy,
//   differs per fork because `merge`-synced installers carry merge-commit SHAs).
// - semver = package.json version (human-managed) → stable across forks, so it
//   reads identically on origin and installers. Use this for sync monitoring.
export const dynamic = "force-dynamic";

export function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json(
    { version, semver: pkg.version },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
