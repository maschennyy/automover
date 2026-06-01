import {
  app, BrowserWindow, ipcMain, Tray, Menu,
  nativeImage, dialog, Notification, shell,
} from 'electron'
import path        from 'path'
import fs          from 'fs'
import { fileURLToPath } from 'url'
import Store       from 'electron-store'
import { createRequire } from 'module'

const _require       = createRequire(import.meta.url)
const watcherManager = _require('./fileWatcher')

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ─── Electron Store Schema ────────────────────────────────────────────────────
const store = new Store({
  name: 'automover-data',
  schema: {
    rules: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id:               { type: 'string' },
          name:             { type: 'string' },
          watchFolder:      { type: 'string' },
          filters: {
            type: 'object',
            properties: {
              extensions:  { type: 'array', items: { type: 'string' }, default: [] },
              namePattern: { type: 'string', default: '' },
            },
          },
          action:           { type: 'string', enum: ['move', 'copy'], default: 'move' },
          destination:      { type: 'string' },
          autoCreateFolder: { type: 'boolean', default: true },
          isActive:         { type: 'boolean', default: true },
        },
        required: ['id', 'watchFolder', 'destination'],
      },
    },
    logs: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id:        { type: 'string' },
          timestamp: { type: 'string' },
          ruleId:    { type: 'string' },
          fileName:  { type: 'string' },
          from:      { type: 'string' },
          to:        { type: 'string' },
          action:    { type: 'string' },
          undone:    { type: 'boolean', default: false },
        },
        required: ['id', 'timestamp', 'fileName', 'from', 'to', 'action'],
      },
    },
    settings: {
      type: 'object',
      default: {
        autoMonitor:              false,
        minimizeToTray:           true,
        showNotifications:        true,
        onboardingComplete:       false,
        runAtStartup:             false,
        trayHintShown:            false,   // show "still running in tray" only once
      },
      properties: {
        autoMonitor:              { type: 'boolean' },
        minimizeToTray:           { type: 'boolean' },
        showNotifications:        { type: 'boolean' },
        onboardingComplete:       { type: 'boolean' },
        runAtStartup:             { type: 'boolean' },
        trayHintShown:            { type: 'boolean' },
      },
    },
  },
})

// ─── Globals ──────────────────────────────────────────────────────────────────
let mainWindow = null
let tray       = null

// ─── Persistent log helper ────────────────────────────────────────────────────
function persistLogEntry(logEntry) {
  if (!logEntry || !logEntry.id) return { success: false, error: 'Invalid log entry' }

  const logs = store.get('logs')
  const alreadyExists = logs.some(l => l.id === logEntry.id)
  if (!alreadyExists) logs.unshift(logEntry)

  if (logs.length > 500) logs.splice(500)
  store.set('logs', logs)
  return { success: true, logs }
}

watcherManager.setLogHandler((logEntry) => {
  persistLogEntry(logEntry)
})

// ─── Tray icon helper ─────────────────────────────────────────────────────────
function loadTrayIcon() {
  // In dev/production look for the PNG in the assets folder next to the built main.
  // Falls back to an empty image so the app doesn't crash when asset is missing.
  const candidates = [
    path.join(__dirname, '../../assets/tray-icon.png'),
    path.join(__dirname, '../assets/tray-icon.png'),
    path.join(app.getAppPath(), 'assets/tray-icon.png'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      // macOS: template images render correctly in both light and dark menu bar
      if (process.platform === 'darwin') img.setTemplateImage(true)
      return img
    }
  }
  return nativeImage.createEmpty()
}

// ─── Build tray tooltip string ────────────────────────────────────────────────
function trayTooltip() {
  const status = watcherManager.getStatus()
  if (status.isActive && status.watchingFolders.length > 0) {
    return `AutoMover — Memantau ${status.watchingFolders.length} folder`
  }
  return 'AutoMover — Nonaktif'
}

// ─── Build tray context menu (called on every state change) ──────────────────
function buildTrayMenu() {
  const settings     = store.get('settings')
  const isMonitoring = watcherManager.isActive

  const menu = Menu.buildFromTemplate([
    // Header row — non-interactive
    {
      label:   'AutoMover',
      enabled: false,
      // macOS shows this as the menu title
    },
    { type: 'separator' },

    // Monitor status indicator
    {
      label:   isMonitoring
        ? `● Memantau ${watcherManager.watchers.size} folder`
        : '○ Monitoring Nonaktif',
      enabled: false,
    },

    // Toggle monitoring
    {
      label:   isMonitoring ? 'Matikan Auto-Monitor' : 'Aktifkan Auto-Monitor',
      type:    'normal',
      click:   async () => {
        if (isMonitoring) {
          store.set('settings.autoMonitor', false)
          watcherManager.stop()
        } else {
          const rules = store.get('rules')
          store.set('settings.autoMonitor', true)
          watcherManager.start(rules, mainWindow)
        }
        // Propagate to renderer
        safeSendToRenderer('settings:changed', store.get('settings'))
        // Rebuild menu to reflect new state
        refreshTray()
      },
    },

    { type: 'separator' },

    // One-Click Clean
    {
      label: '⚡ Rapihkan Sekarang',
      click: async () => {
        const { scanAndSort } = _require('./fileOps')
        const rules       = store.get('rules')
        const activeRules = rules.filter(r => r.isActive)
        const folders     = [...new Set(activeRules.map(r => r.watchFolder).filter(Boolean))]
        for (const folder of folders) {
          try {
            const result = scanAndSort(folder, activeRules)
            for (const logEntry of result.success) {
              persistLogEntry(logEntry)
              safeSendToRenderer('watcher:fileProcessed', logEntry)
            }
          } catch (err) {
            console.error('[Tray RunNow]', err.message)
          }
        }
      },
    },

    { type: 'separator' },

    // Show window
    {
      label: 'Buka AutoMover',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
        if (process.platform === 'darwin') app.dock?.show()
      },
    },

    { type: 'separator' },

    // Quit
    {
      label: 'Keluar',
      click: () => {
        app.isQuitting = true
        watcherManager.stop()
        app.quit()
      },
    },
  ])

  return menu
}

// ─── Refresh tray menu and tooltip ───────────────────────────────────────────
function refreshTray() {
  if (!tray || tray.isDestroyed()) return
  tray.setContextMenu(buildTrayMenu())
  tray.setToolTip(trayTooltip())
}

// ─── Safe IPC push to renderer ────────────────────────────────────────────────
function safeSendToRenderer(channel, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send(channel, payload)
    }
  } catch { /* window may be closing */ }
}

// ─── Window creation ──────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1100,
    height:          720,
    minWidth:        860,
    minHeight:       560,
    frame:           false,
    transparent:     false,
    backgroundColor: '#111116',
    titleBarStyle:   'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    show:            false,     // show after ready-to-show to avoid flash
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  })

  // Show window only when content is ready — avoids white flash
  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // ── Close event: hide to tray instead of quitting ────────────────────────
  mainWindow.on('close', (event) => {
    if (app.isQuitting) return   // let it close normally on explicit quit

    const settings = store.get('settings')
    if (!settings.minimizeToTray) return   // user preference: quit on close

    event.preventDefault()
    mainWindow.hide()

    // macOS: hide dock icon when window is hidden
    if (process.platform === 'darwin') app.dock?.hide()

    // Show the "still running in tray" notification only once ever
    if (!settings.trayHintShown) {
      store.set('settings.trayHintShown', true)
      if (Notification.isSupported()) {
        new Notification({
          title: 'AutoMover masih berjalan',
          body:  'Aplikasi tetap aktif di system tray. Klik dua kali ikon tray untuk membuka kembali.',
          silent: false,
        }).show()
      }
    }

    refreshTray()
  })

  mainWindow.on('show', () => refreshTray())
}

// ─── System tray ─────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(loadTrayIcon())
  tray.setToolTip(trayTooltip())
  tray.setContextMenu(buildTrayMenu())

  // Double-click shows window (Windows / Linux)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
    if (process.platform === 'darwin') app.dock?.show()
  })

  // Single click on macOS shows context menu automatically via setContextMenu.
  // On Windows/Linux it may not — explicitly show it on click.
  tray.on('click', () => {
    if (process.platform !== 'darwin') {
      tray.popUpContextMenu()
    }
  })
}

// ─── IPC Handlers: Rules ──────────────────────────────────────────────────────
ipcMain.handle('rules:getAll', () => store.get('rules'))

ipcMain.handle('rules:save', (_event, rules) => {
  store.set('rules', rules)
  return { success: true }
})

ipcMain.handle('rules:add', (_event, rule) => {
  const rules = store.get('rules')
  rules.push(rule)
  store.set('rules', rules)
  if (watcherManager.isActive) watcherManager.restart(rules, mainWindow)
  return { success: true, rules }
})

ipcMain.handle('rules:update', (_event, updatedRule) => {
  const rules = store.get('rules')
  const idx   = rules.findIndex(r => r.id === updatedRule.id)
  if (idx === -1) return { success: false, error: 'Rule not found' }
  rules[idx] = updatedRule
  store.set('rules', rules)
  if (watcherManager.isActive) watcherManager.restart(rules, mainWindow)
  return { success: true, rules }
})

ipcMain.handle('rules:delete', (_event, ruleId) => {
  const rules    = store.get('rules')
  const filtered = rules.filter(r => r.id !== ruleId)
  store.set('rules', filtered)
  if (watcherManager.isActive) watcherManager.restart(filtered, mainWindow)
  return { success: true, rules: filtered }
})

// ─── IPC Handlers: Watcher ───────────────────────────────────────────────────
ipcMain.handle('watcher:start', async () => {
  const rules = store.get('rules')
  store.set('settings.autoMonitor', true)
  safeSendToRenderer('settings:changed', store.get('settings'))
  const result = watcherManager.start(rules, mainWindow)
  refreshTray()
  return result
})

ipcMain.handle('watcher:stop', async () => {
  store.set('settings.autoMonitor', false)
  safeSendToRenderer('settings:changed', store.get('settings'))
  const result = watcherManager.stop()
  refreshTray()
  return result
})

ipcMain.handle('watcher:getStatus', async () => watcherManager.getStatus())

ipcMain.handle('watcher:runNow', async () => {
  const { scanAndSort } = _require('./fileOps')
  const rules       = store.get('rules')
  const activeRules = rules.filter(r => r.isActive === true)
  const allResults  = { success: [], errors: [] }
  const folders     = [...new Set(activeRules.map(r => r.watchFolder).filter(Boolean))]

  for (const folder of folders) {
    try {
      const result = scanAndSort(folder, activeRules)
      allResults.success.push(...result.success)
      allResults.errors.push(...result.errors)

      for (const logEntry of result.success) {
        persistLogEntry(logEntry)
        safeSendToRenderer('watcher:fileProcessed', logEntry)
      }
    } catch (err) {
      allResults.errors.push({ folder, error: err.message })
    }
  }
  return allResults
})

// ─── IPC Handlers: Logs ──────────────────────────────────────────────────────
ipcMain.handle('logs:getAll', () => store.get('logs'))

ipcMain.handle('logs:add', (_event, logEntry) => persistLogEntry(logEntry))

ipcMain.handle('logs:markUndone', (_event, logId) => {
  const logs  = store.get('logs')
  const index = logs.findIndex(l => l.id === logId)
  if (index === -1) return { success: false, error: 'Log entry not found' }
  logs[index].undone = true
  store.set('logs', logs)
  return { success: true }
})

ipcMain.handle('logs:clear', () => {
  store.set('logs', [])
  return { success: true }
})

// ─── IPC Handlers: FileOps (Undo) ────────────────────────────────────────────
ipcMain.handle('fileOps:undo', async (_event, logEntry) => {
  const { undoAction } = _require('./fileOps')
  try {
    const result = undoAction(logEntry)
    const logs   = store.get('logs')
    const idx    = logs.findIndex(l => l.id === logEntry.id)
    if (idx !== -1) { logs[idx].undone = true; store.set('logs', logs) }
    return { success: true, updatedLog: result.updatedLog }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC Handlers: Store aliases ─────────────────────────────────────────────
ipcMain.handle('store:getRules',  () => store.get('rules'))
ipcMain.handle('store:getLogs',   () => store.get('logs'))

ipcMain.handle('store:saveRules', (_event, rules) => {
  store.set('rules', rules); return { success: true }
})
ipcMain.handle('store:saveLogs', (_event, logs) => {
  store.set('logs', Array.isArray(logs) ? logs.slice(0, 500) : [])
  return { success: true }
})

// ─── IPC Handlers: Settings ───────────────────────────────────────────────────
ipcMain.handle('settings:get', () => store.get('settings'))

ipcMain.handle('settings:update', (_event, partial) => {
  const updated = { ...store.get('settings'), ...partial }
  store.set('settings', updated)

  // Apply login-item preference immediately
  if (partial.runAtStartup !== undefined) {
    app.setLoginItemSettings({ openAtLogin: partial.runAtStartup })
  }

  safeSendToRenderer('settings:changed', updated)
  return { success: true, settings: updated }
})

// ─── IPC Handlers: App-level ─────────────────────────────────────────────────

/** Toggle OS auto-start */
ipcMain.handle('app:setLoginItem', async (_event, openAtLogin) => {
  app.setLoginItemSettings({ openAtLogin })
  store.set('settings.runAtStartup', openAtLogin)
  return { success: true }
})

/** Return package.json version */
ipcMain.handle('app:getVersion', async () => app.getVersion())

/** Return merged app settings (used by SettingsPanel) */
ipcMain.handle('app:getSettings', async () => {
  return store.get('settings')
})

/** Save app settings and apply side-effects */
ipcMain.handle('app:saveSettings', async (_event, settings) => {
  const merged = { ...store.get('settings'), ...settings }
  store.set('settings', merged)
  if (settings.runAtStartup !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.runAtStartup })
  }
  safeSendToRenderer('settings:changed', merged)
  return { success: true }
})

/** Return electron-store config file path (shown in Settings UI) */
ipcMain.handle('app:getConfigPath', async () => store.path)

/** Open config file in default editor */
ipcMain.handle('app:openConfigFile', async () => {
  shell.openPath(store.path)
  return { success: true }
})

// ─── IPC Handlers: Dialog ─────────────────────────────────────────────────────
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title:      'Pilih Folder',
  })
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title:      'Pilih Folder',
  })
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
})

// ─── IPC Handlers: Notifications ─────────────────────────────────────────────
ipcMain.handle('notify', (_event, { title, body }) => {
  if (!store.get('settings').showNotifications) return
  if (Notification.isSupported()) new Notification({ title, body }).show()
})

// ─── IPC Handlers: Window Controls ───────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
})
ipcMain.on('window:close', () => {
  const settings = store.get('settings')
  if (settings.minimizeToTray && tray && !tray.isDestroyed()) {
    mainWindow?.hide()
    if (process.platform === 'darwin') app.dock?.hide()
  } else {
    app.isQuitting = true
    watcherManager.stop()
    app.quit()
  }
})

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()

  // macOS: hide dock initially if watcher will run in background
  const settings = store.get('settings')
  if (settings.minimizeToTray && process.platform === 'darwin') {
    // Keep dock visible for first run; hide only after user minimizes
  }

  // Auto-resume watcher from previous session
  if (settings.autoMonitor) {
    const rules = store.get('rules')
    setTimeout(() => {
      watcherManager.start(rules, mainWindow)
      refreshTray()
    }, 1500)
  }
})

app.on('activate', () => {
  // macOS: click dock icon
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else {
    mainWindow?.show()
    mainWindow?.focus()
    if (process.platform === 'darwin') app.dock?.show()
  }
})

app.on('window-all-closed', () => {
  // On macOS and when tray exists: don't quit when last window closes
  if (tray && !tray.isDestroyed()) return
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  app.isQuitting = true
  // Graceful shutdown: stop all watchers before exiting
  watcherManager.stop()
})
