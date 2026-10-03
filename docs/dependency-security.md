# Dependency security

The production dependency audit covers libraries compiled into the application.
`npm run audit:electron` also checks the shipped Electron binary, which npm otherwise excludes
because the framework is installed as a development dependency. Both checks must pass in CI and
in release build jobs before packaging.

## October 2026 updates

Electron 43.7.7 includes the fix for
[sandboxed preload cache poisoning](https://github.com/electron/electron/security/advisories/GHSA-qmv3-fv6v-rmhq).
Vitest and coverage use 4.1.11, SVGO uses 4.1.0, and vulnerable XML, URI, brace expansion, and HTTP
client dependencies were updated within their existing supported ranges. No major overrides or
packager downgrades are needed.

## Remaining build-tool advisory

The full development audit still reports the
[http-cache-semantics shared-cache advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp),
including seven packages in its dependency chain. There is no published patched version as of
October 3, 2026. Electron Builder 26.15.3 is the current stable packager; npm's force-fix proposal
downgrades it to 26.5.0 instead of fixing this dependency.

The dependency is reachable only through Electron Builder's `@electron/get` 3.1.0 downloader and
its `got` 11 HTTP client. Got's HTTP cache defaults to disabled, and this repository does not enable
it or supply cache headers. Builds download public Electron/tool binaries rather than serving
authenticated responses to different users through a shared HTTP cache. The artifact cache on disk
is separate from the affected HTTP response cache. These packages are excluded from the compiled
application and its staged archive.

This is an exposure assessment, not a claim that the upstream advisory is fixed. Reassess when
the packager publishes an update or when downloader options, authenticated mirrors, or HTTP caches
change. Keep the full development audit visible during dependency updates; do not use a blanket
force-fix, downgrade, or incompatible HTTP-client override to hide the warning.
