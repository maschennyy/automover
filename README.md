# AutoMover

Aplikasi desktop untuk mengotomatisasi sortir dan pemindahan file berdasarkan aturan ekstensi atau pola nama.

## Tech Stack

- **Electron.js** — desktop wrapper + main process (Node.js)
- **React + Vite** — renderer / UI
- **Tailwind CSS** — styling
- **Zustand** — state management (renderer)
- **electron-store** — persistent storage (JSON lokal)
- **chokidar** — file system watcher *(Phase 4)*

## Setup

```bash
# Install dependencies
npm install

# Development mode (Vite dev server + Electron)
npm run electron:dev

# Production build
npm run electron:build
```

## Project Structure

```
automover/
├── src/
│   ├── main/                   # Electron main process (Node.js)
│   │   ├── index.js            # App entry, IPC handlers, window, tray
│   │   ├── preload.js          # contextBridge API surface
│   │   ├── fileWatcher.js      # chokidar watcher logic        [Phase 4]
│   │   └── fileOps.js          # move/copy/undo file operations [Phase 3]
│   └── renderer/               # React application
│       ├── components/
│       │   ├── RuleBuilder.jsx  # Rule form modal               [Phase 2]
│       │   ├── RuleList.jsx     # Rule cards list               [Phase 2]
│       │   ├── ActivityLog.jsx  # Log table + undo              [Phase 5]
│       │   └── TrayMenu.jsx     # Tray context menu             [Phase 6]
│       ├── store/
│       │   └── useAppStore.js   # Zustand store (rules, logs, settings, ui)
│       ├── App.jsx              # Shell layout + routing
│       ├── main.jsx             # React entry point
│       └── index.css            # Global styles + CSS variables
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Setup proyek + electron-store + Zustand store | ✅ Done |
| 2 | RuleBuilder UI (form tambah/edit/hapus aturan) | ⏳ Next |
| 3 | fileOps.js (logic move/copy + auto-create folder) | ⏳ |
| 4 | fileWatcher.js (chokidar + IPC ke renderer) | ⏳ |
| 5 | ActivityLog UI + fungsi Undo | ⏳ |
| 6 | System tray + background mode + notifikasi | ⏳ |

## Data Schema

### Rule
```json
{
  "id": "uuid-v4",
  "name": "Nama aturan (opsional)",
  "watchFolder": "C:/Users/Name/Downloads",
  "filters": {
    "extensions": [".pdf", ".docx"],
    "namePattern": "Invoice_*"
  },
  "action": "move",
  "destination": "C:/Users/Name/Documents/Tagihan",
  "autoCreateFolder": true,
  "isActive": true
}
```

### Log Entry
```json
{
  "id": "uuid-v4",
  "timestamp": "2026-05-30T08:00:00.000Z",
  "ruleId": "uuid-v4",
  "fileName": "Invoice_001.pdf",
  "from": "C:/Users/Name/Downloads/Invoice_001.pdf",
  "to": "C:/Users/Name/Documents/Tagihan/Invoice_001.pdf",
  "action": "move",
  "undone": false
}
```
