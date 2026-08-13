<div align="center">

![notation.LABS Logo](docs/images/logo.png)

**A combo tracker for fighting game players**

Build, visualize, organize, and share combos using standard fighting game notation with graphical input displays.

[![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: GPL v3+](https://img.shields.io/badge/License-GPLv3+-blue.svg)](LICENSE)

</div>

---


## ✨ Features

- **Community Notation Styles** — Supports Standard / Numpad, NRS, and Tekken notation with style-aware parsing and icons
- **Dual Display Modes** — Toggle between custom colored text and visual icon display for combos
- **Beautiful Organization** — Organize your combos by game and character with cover images
- **Import / Export** — Backup, restore, and share your entire library or individual combos as JSON
- **Search & Filter** — Search across combo names, tags, and descriptions with multiple filters
- **Video Demonstrations** — Attach local videos or YouTube links to combos for visual reference
- **Offline-First** — All data stored locally via IndexedDB — no account, no cloud, no tracking
- **Auto-Updates** — Built-in update system keeps you on the latest version

## 📸 Screenshots

<details>
<summary>🎮 Game Library</summary>

![Game Library](docs/images/home.png)
*Browse and manage your fighting game collection*

</details>

<details>
<summary>🥊 Character Select</summary>

![Character Select](docs/images/characters.png)
*Select a character to view and manage their combos*

</details>

<details>
<summary>🎮 Combo View — Icon Mode</summary>

![Combo View](docs/images/icons.png)
*View combos with graphical input icons and tags*

</details>

<details>
<summary>🎮 Demo Video</summary>

![Combo View](docs/images/demo.png)
*View youtube or embeded videos*

</details>

<details>
<summary>➕ Adding a Combo</summary>

![Add Combo](docs/images/add.png)
*Create combos with notation, tags, and video demonstrations*

</details>

<details>
<summary>⚙️ Settings</summary>

![Settings](docs/images/settings.png)
*Customize display, notation colors, and button layouts*

</details>

## 🚀 Getting Started

### Option 1: Online Demo (No Install)

1. Visit <a href="https://labs.kevinkickback.com/" target="_blank"><b>labs.kevinkickback.com</b></a> to try notation.LABS instantly in your browser. Not all features available.


### Option 2: Download Release (Recommended)

1. Download the package for your platform from the [Releases](https://github.com/kevinkickback/notation.LABS/releases/latest) page:

   - Windows: installer or portable `.exe`
   - macOS: `.dmg`
   - Debian, Ubuntu, or Linux Mint: `.deb`
   - Other Linux distributions: `.AppImage`

2. Install or open the downloaded app

### Option 3: Build from Source

**Prerequisites:** [Node.js](https://nodejs.org/) (v18 or later)

```bash
git clone https://github.com/kevinkickback/notation.LABS.git
cd notation.LABS
npm install
npm run dev:web
```

## 🕹️ Notation Reference

| Notation | Meaning |
|----------|---------|
| `>` / `→` / `»` | Proceed from the previous move to the following move |
| `\|>` / `(Land)` | Indicate that the player must land at that point in the sequence |
| `,` | Link the previous move into the following move |
| `~` | Cancel the previous special into a follow-up |
| `+` | Press buttons simultaneously |
| `xx` | Cancel the previous move into a special move |
| `dl.` | Delay the following move |
| `(whiff)` | The move must whiff (not hit) |
| `cl.` | Close |
| `f.` | Far |
| `j.` | Jumping/Aerial |
| `nj.` | Neutral Jump |
| `dj.` | Double Jump |
| `sj.` | Super Jump |
| `iad` | Instant Air Dash |
| `jc.` | Jump Cancel |
| `sjc.` | Super Jump Cancel |
| `dd.` / `22` | Double Down |
| `back dash` / `44` | Back Dash |
| `dash` / `66` | Forward Dash |
| `CH` | Counter Hit |
| `[X]` | Hold or charge input X |
| `]X[` | Release input X |
| `XxN` / `(sequence)xN` | Repeat an input or sequence N times |
| `(N)` | Hit N of a move or move must deal N amount of hits |
| `qcf.` / `236` | Quarter Circle Forward |
| `qcb.` / `214` | Quarter Circle Back |
| `dp.` / `623` | Dragon Punch |
| `rdp.` / `421` | Reverse Dragon Punch |
| `hcf.` / `41236` | Half Circle Forward |
| `hcb.` / `63214` | Half Circle Back |
| `hcbf` | Half Circle Back, then Forward |
| `2qcf.` / `236236` | Double Quarter Circle Forward |
| `2qcb.` / `214214` | Double Quarter Circle Back |
| `360` / `spd` | Full circle motion |
| `720` / `1080` | Double or triple circle motion |

### Notation Styles

- **Standard / Numpad** — Numbers are directions, including motions such as
  `236H` and `623K`. Traditional aliases such as `qcf` and `dp` also work.
- **NRS** — Supports Mortal Kombat, Injustice, and other NRS games. `1`–`4`
  are attack buttons, direction strings are sequential and case-insensitive,
  and slash diagonals such as `U/F` remain one input.
- **Tekken** — `1`–`4` are attack buttons; lowercase directions are taps,
  uppercase directions are holds, and diagonals remain one input.

## 📄 License

This project is licensed under the GNU General Public License v3.0 or later — see the [LICENSE](LICENSE) file for details.
