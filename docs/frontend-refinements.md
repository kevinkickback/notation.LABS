# Frontend refinements

These refinements retain main's page layout, cards, navigation, and theme.

## Startup

The renderer displays a loading overlay while saved preferences, notation
migrations, and the game library initialize. Stage descriptions and progress
reflect those tasks. Startup errors keep the overlay visible with a retry action.
The workspace stays inert until initialization completes, then the overlay fades.
The overlay inherits the application theme and respects reduced motion.
The splash preserves the detailed artwork in `src/assets/branding/splash-logo.png`.
It displays a larger mark above the title, with a smaller size in short windows.
The header uses a flat SVG companion mark with solid colors and stronger edges.
Small app icons use simplified artwork at 16px and 24px. The Windows icon contains
native frames from 16px through 256px; a 512px PNG serves macOS and Linux. The browser
favicon uses the same multi-size icon. Both compact directions and their native PNG
exports live in `src/assets/branding/`; regenerate them with `npm run assets:branding`
after installing Playwright's Chromium browser. The detailed splash stays separate.
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
Game and character editor column dividers span the taller column. Settings
navigation has square corners; delete confirmations have no internal dividers.

Settings uses a shared height across categories, with vertical category navigation
on desktop and a horizontal row on smaller windows. The notation guide places its
live preview beside the reference on wide windows and above it on narrow windows;
community examples can be tried directly. Alternate motion examples are centered
on a contrasting surface without changing the icons' colors.

Controlled dialogs restore focus to the invoking control when it remains present,
including returning from image search to its parent editor. Motion stays brief and
respects reduced-motion preferences. Notes and resources use a shared floating or
docked notebook. Export commit-phase protections are preserved.
The floating drawer portals inside its page workspace so pending navigation also
blocks its editing controls. Resource entry accepts HTTP/S URLs and schemeless
hosts, including ports, by adding HTTPS when needed.
Opening, docking, and editing explicitly move focus to the panel or editor;
restored panels and responsive layout changes preserve focus outside the notebook.
If an open preference rolls back, either layout returns lost focus to its opener.
Editor save/cancel returns focus to the initiating Add/Edit action. Removing a
focused resource returns it to Add; a failed dock choice restores its layout control.
The dock stays at the workspace's measured top while scrolling, below the sticky
header and breadcrumb. That same offset sets its available height above the footer.

## Collection cards and notes

The card-size slider controls the same card width in both the game and character
grids. Every 10-pixel step changes that width, with cards wrapping rather than
stretching to fill a row. Portrait and landscape artwork retain their proportions;
cards shrink to fit containers narrower than the chosen width.

Each game and character remembers whether its notebook is open or closed. New
pages start closed; there is no global default-open setting. Existing preferences
and older backups migrate to explicit page choices, preserving their prior state.
Floating or docked layout is one saved preference throughout the app. Narrow
windows temporarily float the notebook without replacing the docking preference.
The adjusted dock width is also shared across pages and restarts. Dragging saves
on release; keyboard adjustments and double-click reset save immediately. Smaller
windows constrain the displayed width without overwriting the saved choice.
Settings writes and manual panel choices save in invocation order. Failed writes
do not prevent later queued settings from saving. Deleting a game or character
also removes its remembered page choice.
The latest panel toggle stays visible through unrelated settings refreshes and
earlier queued writes until its own save is acknowledged. Changing the selected
entity discards the previous optimistic choice.
Each settings request has an increasing token. Live snapshots identify the queued
writes completed before their read, so an earlier save with the same value cannot
clear a later pending choice. Failure rollback also checks the latest token per
setting rather than comparing values.

## Status bar

The bottom bar displays the app version first, followed by update state when
available. A successful update check displays “Up to date” with a green indicator;
checks, available updates, and downloads use the application accent. Available
updates can be selected to reopen their details. Errors retain their detail in a
tooltip. Offline checks display “Offline · updates unavailable,” while known
available and downloaded updates remain visible. Idle online state shows only the
version, rather than claiming a check succeeded. The footer omits library counts
and image-search status, and uses main's existing surfaces and colors.
Confirmed update metadata is retained separately from transient checks and errors,
so an offline recheck preserves the update and its details action. A successful
check reporting no update clears that metadata. Error details take priority over
generic connection advice in tooltips.
The initial desktop status snapshot cannot replace newer update events. It can
seed otherwise missing confirmed metadata when no newer availability result has
superseded it. Starting or retrying a download clears previous errors and progress;
downloads from saved release details retain the selected version.
