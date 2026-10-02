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

## Page navigation

Game, character, and combo reads resolve as one page snapshot labeled with its
destination and notation version. Navigation keeps the last complete page visible
until the next snapshot is ready, and temporarily disables its main content.
Breadcrumbs describe the visible page. Pending or retained query results never
stand in for an empty collection; real empty states appear only after a completed
read. Read failures continue to use the loading overlay and retry flow.

## Dialogs

Dialog layouts use main's colors, type, and rounded surfaces. Game, character, and
combo editors use field labels rather than repeated section titles. Wide windows
show related fields side by side; small windows stack them in a scrollable body
with accessible actions. The game editor gives notation more space than artwork.
Only one divider separates the final fields from the action footer.

Settings uses a shared height across categories, with vertical category navigation
on desktop and a horizontal row on smaller windows. The notation guide places its
live preview beside the reference on wide windows and above it on narrow windows;
community examples can be tried directly. Alternate motion examples are centered
on a contrasting surface without changing the icons' colors.

Controlled dialogs restore focus to the invoking control when it remains present,
including returning from image search to its parent editor. Motion stays brief and
respects reduced-motion preferences. Existing notes behavior and settings remain
available because main's notes panels are retained. Export commit-phase protections
are preserved.

## Status bar

The bottom bar displays the app version first, followed by update state when
available. A successful update check displays “Up to date” with a green indicator;
checks, available updates, and downloads use the application accent. Available
updates can be selected to reopen their details. Errors retain their detail in a
tooltip. Offline checks display “Offline · updates unavailable,” while known
available and downloaded updates remain visible. Idle online state shows only the
version, rather than claiming a check succeeded. The footer omits library counts
and image-search status, and uses main's existing surfaces and colors.
