# Frontend refinements

These refinements retain main's page layout, cards, navigation, and theme.

## Startup

The renderer displays a loading overlay while saved preferences, notation
migrations, and the game library initialize. Stage descriptions and progress
reflect those tasks. Startup errors keep the overlay visible with a retry action.
The workspace stays inert until initialization completes, then the overlay fades.
The overlay inherits the application theme and respects reduced motion.
Rejected settings and library reads stay in startup state rather than escaping to
the global error page. Retry restarts initialization and the reactive reads; cached
results from an earlier retry cannot mark the new attempt ready. Detailed errors
are announced as alerts. Workspace components mount after startup completes so
their own queries cannot bypass the startup error and retry flow.

Electron opens one application window rather than a separate splash window.
It retains context isolation, sandboxing, and disabled renderer Node access.
Development uses a separate `notation-labs-development` profile so the installed
app's database and Chromium cache are not locked by development. Each profile
allows one app instance; subsequent launches focus its existing window.

Run `npm run dev:web` for browser development or `npm run dev:app` for the isolated
desktop profile. Development image search uses deployed providers by default.
Use `VITE_USE_LOCAL_PROVIDERS=true` in `.env.local` to opt into local providers;
`NOTATION_IGDB_PROXY_TARGET` and `NOTATION_IMAGE_PROXY_TARGET` override their targets.
