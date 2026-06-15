// Version comes from the registration query (?v=<commit-sha>), so every deploy
// gets a fresh shell cache name — old shell caches are purged on activate and
// the shell is re-precached from the new build.
//
// Static assets (/_next/static/*) live in a SEPARATE, version-independent cache
// that is NOT purged on activate. This is what keeps offline working across
// deploys: a new deploy changes the chunk hashes, but old chunks survive as a
// fallback and new chunks are precached at install time (see below) instead of
// only being cached lazily on first request. Without this, activate wiped every
// chunk and an offline user hit a cache-miss on the new build's JS → blank app.
const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "v3";
const CACHE_NAME = "basic-note-" + SW_VERSION;
const STATIC_CACHE = "basic-note-static";

// Shell routes that must work fully offline. We precache BOTH variants:
//  - the HTML document (full page load / PWA cold start)
//  - the RSC flight payload (App Router client-side navigation, ?_rsc=)
// The note editor lives at the single static route /notes/note (id is in the
// query string, read client-side), so one fixed RSC payload serves every note
// — enabling offline "create → open" and "list → open" with no per-id fetch.
const SHELL_DOC_URLS = ["/", "/notes", "/notes/note"];
const SHELL_RSC_URLS = ["/notes", "/notes/note"];

// Synthetic cache key for an RSC variant (kept distinct from the document).
const rscKey = (pathname) => `${pathname}?__swrsc=1`;

const isRscRequest = (request, url) =>
  request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");

const isShellPath = (pathname) =>
  pathname === "/notes" || pathname === "/notes/note";

const isStaticAsset = (request) =>
  /\.(js|css|woff2?|ttf|png|jpg|svg|ico)(\?.*)?$/.test(request.url) ||
  request.url.includes("/_next/static/");

// Pull every /_next/static JS/CSS URL referenced by a shell HTML document
// (script src + link href, incl. prefetch). These are the chunks the page
// needs to boot; precaching them is what makes the app usable offline.
function extractStaticAssets(html) {
  const urls = new Set();
  const re = /(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g;
  let m;
  while ((m = re.exec(html))) urls.add(m[1]);
  return [...urls];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const staticCache = await caches.open(STATIC_CACHE);
      const assetUrls = new Set();

      // Precache shell documents AND harvest the static chunks they reference.
      await Promise.all(
        SHELL_DOC_URLS.map(async (path) => {
          try {
            const res = await fetch(path, { credentials: "same-origin" });
            if (!res.ok) return;
            await cache.put(path, res.clone());
            const html = await res.text();
            extractStaticAssets(html).forEach((u) => assetUrls.add(u));
          } catch {
            // offline during install — best effort
          }
        })
      );

      // Precache RSC payloads by requesting each route with the RSC header.
      await Promise.all(
        SHELL_RSC_URLS.map(async (path) => {
          try {
            const res = await fetch(path, {
              headers: { RSC: "1" },
              credentials: "same-origin",
            });
            if (res.ok) await cache.put(rscKey(path), res);
          } catch {
            // best effort
          }
        })
      );

      // Precache the harvested static chunks into the shared cache so the new
      // build boots offline immediately after this install completes.
      await Promise.all(
        [...assetUrls].map(async (u) => {
          try {
            if (await staticCache.match(u)) return; // already cached
            const res = await fetch(u, { credentials: "same-origin" });
            if (res.ok) await staticCache.put(u, res);
          } catch {
            // best effort
          }
        })
      );

      // Tell the app the shell + editor route are fully cached. Until this
      // fires, going offline is unsafe: in-memory router prefetch covers the
      // first navigation or two, then a live RSC fetch is needed and there's
      // no cache to fall back on yet → note entry breaks. The app shows a
      // one-time "offline ready" toast so first-run users stay online briefly.
      const windows = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      windows.forEach((c) =>
        c.postMessage({ type: "offline-ready", version: SW_VERSION })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // Purge old SHELL caches only; keep the current shell cache and the
          // version-independent static-asset cache (the offline fallback).
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin))
    return;

  const url = new URL(request.url);

  // Skip API/Supabase requests — always network
  if (url.pathname.includes("/api/") || request.url.includes("supabase")) return;

  // Shell routes (/notes, /notes/note): network-first, but fall back to the
  // precached document or RSC payload when offline. The query string (id,
  // _rsc hash) is stripped via a fixed cache key, so any note id resolves.
  if (isShellPath(url.pathname)) {
    const isRsc = isRscRequest(request, url);
    const key = isRsc ? rscKey(url.pathname) : url.pathname;
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(key, clone));
          return response;
        })
        .catch(async () => {
          if (isRsc) {
            // NEVER serve an HTML document to an RSC fetch — that yields a
            // broken partial render and (for /notes/note) bounces the user back
            // to the list = "note won't open". On miss, error out so the client
            // retries as a hard navigation, which the document branch serves.
            return (
              (await caches.match(key)) ||
              (await caches.match(rscKey("/notes/note"))) ||
              (await caches.match(rscKey("/notes"))) ||
              Response.error()
            );
          }
          // Document request: prefer the EXACT shell doc (so /notes/note opens
          // the editor, not the list), then the root shell.
          return (
            (await caches.match(url.pathname)) ||
            (await caches.match("/")) ||
            Response.error()
          );
        })
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images). Look across all
  // caches (the shared static cache holds chunks from this and prior deploys),
  // and store newly fetched ones in the version-independent static cache.
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Network-first for navigation (other HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
