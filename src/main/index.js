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

const store = new Store({ name: 'automover-data' })

let mainWindow = null
let tray       = null

function persistLogEntry(logEntry) {
  if (!logEntry || !logEntry.id) return { success: false, error: 'Invalid log entry' }
  const logs = store.get('logs') || []
  const alreadyExists = logs.some(l => l.id === logEntry.id)
  if (!alreadyExists) logs.unshift(logEntry)
  if (logs.length > 500) logs.splice(500)
  store.set('logs', logs)
  return { success: true, logs }
}

watcherManager.setLogHandler((logEntry) => persistLogEntry(logEntry))

function loadTrayIcon() {
  const candidates = [path.join(__dirname, '../../assets/tray-icon.png'), path.join(__dirname, '../assets/tray-icon.png'), path.join(app.getAppPath(), 'assets/tray-icon.png')]
  for (const p of candidates) if (fs.existsSync(p)) { const img = nativeImage.createFromPath(p); if (process.platform === 'darwin') img.setTemplateImage(true); return img }
  return nativeImage.createEmpty()
}
function trayTooltip() { const status = watcherManager.getStatus(); return status.isActive && status.watchingFolders.length > 0 ? `AutoMover — Memantau ${status.watchingFolders.length} folder` : 'AutoMover — Nonaktif' }
function safeSendToRenderer(channel, payload) { try { if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) mainWindow.webContents.send(channel, payload) } catch {} }
function refreshTray() { if (!tray || tray.isDestroyed()) return; tray.setContextMenu(buildTrayMenu()); tray.setToolTip(trayTooltip()) }

function buildTrayMenu() {
  const isMonitoring = watcherManager.isActive
  return Menu.buildFromTemplate([
    { label: 'AutoMover', enabled: false }, { type: 'separator' },
    { label: isMonitoring ? `● Memantau ${watcherManager.watchers.size} folder` : '○ Monitoring Nonaktif', enabled: false },
    { label: isMonitoring ? 'Matikan Auto-Monitor' : 'Aktifkan Auto-Monitor', click: async () => { if (isMonitoring) { store.set('settings.autoMonitor', false); watcherManager.stop() } else { const rules = store.get('rules') || []; store.set('settings.autoMonitor', true); watcherManager.start(rules, mainWindow) } safeSendToRenderer('settings:changed', store.get('settings')); refreshTray() } },
    { type: 'separator' },
    { label: '⚡ Rapihkan Sekarang', click: async () => { const { scanAndSort } = _require('./fileOps'); const rules = store.get('rules') || []; const activeRules = rules.filter(r => r.isActive); const folders = [...new Set(activeRules.map(r => r.watchFolder).filter(Boolean))]; for (const folder of folders) { try { const result = scanAndSort(folder, activeRules); for (const logEntry of [...result.success, ...(result.skipped || [])]) { persistLogEntry(logEntry); safeSendToRenderer('watcher:fileProcessed', logEntry) } } catch (err) { console.error('[Tray RunNow]', err.message) } } } },
    { type: 'separator' },
    { label: 'Buka AutoMover', click: () => { mainWindow?.show(); mainWindow?.focus(); if (process.platform === 'darwin') app.dock?.show() } },
    { type: 'separator' },
    { label: 'Keluar', click: () => { app.isQuitting = true; watcherManager.stop(); app.quit() } },
  ])
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1060, height: 700, minWidth: 680, minHeight: 480, frame: false, transparent: false, backgroundColor: '#111116', titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 16 }, show: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  if (process.env.VITE_DEV_SERVER_URL) { mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL); mainWindow.webContents.openDevTools({ mode: 'detach' }) }
  else mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  mainWindow.on('close', (event) => { if (app.isQuitting) return; const settings = store.get('settings') || {}; if (!settings.minimizeToTray) return; event.preventDefault(); mainWindow.hide(); if (process.platform === 'darwin') app.dock?.hide(); if (!settings.trayHintShown) { store.set('settings.trayHintShown', true); if (Notification.isSupported()) new Notification({ title: 'AutoMover masih berjalan', body: 'Aplikasi tetap aktif di system tray. Klik dua kali ikon tray untuk membuka kembali.', silent: false }).show() } refreshTray() })
  mainWindow.on('show', () => refreshTray())
}
function createTray() { tray = new Tray(loadTrayIcon()); tray.setToolTip(trayTooltip()); tray.setContextMenu(buildTrayMenu()); tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); if (process.platform === 'darwin') app.dock?.show() }); tray.on('click', () => { if (process.platform !== 'darwin') tray.popUpContextMenu() }) }

ipcMain.handle('rules:getAll', () => store.get('rules') || [])
ipcMain.handle('rules:save', (_event, rules) => { store.set('rules', Array.isArray(rules) ? rules : []); return { success: true } })
ipcMain.handle('rules:add', (_event, rule) => { const rules = store.get('rules') || []; rules.push(rule); store.set('rules', rules); if (watcherManager.isActive) watcherManager.restart(rules, mainWindow); return { success: true, rules } })
ipcMain.handle('rules:update', (_event, updatedRule) => { const rules = store.get('rules') || []; const idx = rules.findIndex(r => r.id === updatedRule.id); if (idx === -1) return { success: false, error: 'Rule not found' }; rules[idx] = updatedRule; store.set('rules', rules); if (watcherManager.isActive) watcherManager.restart(rules, mainWindow); return { success: true, rules } })
ipcMain.handle('rules:delete', (_event, ruleId) => { const rules = store.get('rules') || []; const filtered = rules.filter(r => r.id !== ruleId); store.set('rules', filtered); if (watcherManager.isActive) watcherManager.restart(filtered, mainWindow); return { success: true, rules: filtered } })

ipcMain.handle('watcher:start', async () => { const rules = store.get('rules') || []; store.set('settings.autoMonitor', true); safeSendToRenderer('settings:changed', store.get('settings')); const result = watcherManager.start(rules, mainWindow); refreshTray(); return result })
ipcMain.handle('watcher:stop', async () => { store.set('settings.autoMonitor', false); safeSendToRenderer('settings:changed', store.get('settings')); const result = watcherManager.stop(); refreshTray(); return result })
ipcMain.handle('watcher:getStatus', async () => watcherManager.getStatus())
ipcMain.handle('watcher:runNow', async () => { const { scanAndSort } = _require('./fileOps'); const rules = store.get('rules') || []; const activeRules = rules.filter(r => r.isActive === true); const allResults = { success: [], skipped: [], errors: [] }; const folders = [...new Set(activeRules.map(r => r.watchFolder).filter(Boolean))]; for (const folder of folders) { try { const result = scanAndSort(folder, activeRules); allResults.success.push(...result.success); allResults.skipped.push(...(result.skipped || [])); allResults.errors.push(...result.errors); for (const logEntry of [...result.success, ...(result.skipped || [])]) { persistLogEntry(logEntry); safeSendToRenderer('watcher:fileProcessed', logEntry) } } catch (err) { allResults.errors.push({ folder, error: err.message }) } } return allResults })

ipcMain.handle('preview:run', async () => { try { const { previewRules } = _require('./fileOps'); return previewRules(store.get('rules') || []) } catch (err) { return { success: false, generatedAt: new Date().toISOString(), items: [], errors: [{ error: err.message }], summary: { planned: 0, error: 1, createFolders: 0, conflicts: 0, renamed: 0, folders: 0 } } } })
ipcMain.handle('preview:execute', async (_event, items) => { try { const { executePreviewItems } = _require('./previewExecutor'); const result = executePreviewItems(items); for (const logEntry of [...result.success, ...(result.skipped || [])]) { persistLogEntry(logEntry); safeSendToRenderer('watcher:fileProcessed', logEntry) } return result } catch (err) { return { success: [], skipped: [], errors: [{ error: err.message }] } } })

ipcMain.handle('logs:getAll', () => store.get('logs') || [])
ipcMain.handle('logs:add', (_event, logEntry) => persistLogEntry(logEntry))
ipcMain.handle('logs:markUndone', (_event, logId) => { const logs = store.get('logs') || []; const index = logs.findIndex(l => l.id === logId); if (index === -1) return { success: false, error: 'Log entry not found' }; logs[index].undone = true; store.set('logs', logs); return { success: true } })
ipcMain.handle('logs:clear', () => { store.set('logs', []); return { success: true } })
ipcMain.handle('fileOps:undo', async (_event, logEntry) => { const { undoAction } = _require('./fileOps'); try { const result = undoAction(logEntry); const logs = store.get('logs') || []; const idx = logs.findIndex(l => l.id === logEntry.id); if (idx !== -1) { logs[idx].undone = true; store.set('logs', logs) }; return { success: true, updatedLog: result.updatedLog } } catch (err) { return { success: false, error: err.message } } })

ipcMain.handle('store:getRules', () => store.get('rules') || [])
ipcMain.handle('store:getLogs', () => store.get('logs') || [])
ipcMain.handle('store:saveRules', (_event, rules) => { store.set('rules', Array.isArray(rules) ? rules : []); return { success: true } })
ipcMain.handle('store:saveLogs', (_event, logs) => { store.set('logs', Array.isArray(logs) ? logs.slice(0, 500) : []); return { success: true } })
ipcMain.handle('settings:get', () => store.get('settings') || {})
ipcMain.handle('settings:update', (_event, partial) => { const updated = { ...(store.get('settings') || {}), ...partial }; store.set('settings', updated); if (partial.runAtStartup !== undefined) app.setLoginItemSettings({ openAtLogin: partial.runAtStartup }); safeSendToRenderer('settings:changed', updated); return { success: true, settings: updated } })
ipcMain.handle('app:setLoginItem', async (_event, openAtLogin) => { app.setLoginItemSettings({ openAtLogin }); store.set('settings.runAtStartup', openAtLogin); return { success: true } })
ipcMain.handle('app:getVersion', async () => app.getVersion())
ipcMain.handle('app:getSettings', async () => store.get('settings') || {})
ipcMain.handle('app:getConfigPath', async () => store.path)
ipcMain.handle('app:openConfigFile', async () => { shell.openPath(store.path); return { success: true } })
ipcMain.handle('app:saveSettings', async (_event, settings) => { const merged = { ...(store.get('settings') || {}), ...settings }; store.set('settings', merged); if (settings.runAtStartup !== undefined) app.setLoginItemSettings({ openAtLogin: settings.runAtStartup }); safeSendToRenderer('settings:changed', merged); return { success: true } })
ipcMain.handle('dialog:selectFolder', async () => { const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Pilih Folder' }); return result.canceled || !result.filePaths.length ? null : result.filePaths[0] })
ipcMain.handle('dialog:openFolder', async () => { const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Pilih Folder' }); return result.canceled || !result.filePaths.length ? null : result.filePaths[0] })
ipcMain.handle('notify', (_event, { title, body }) => { if (!(store.get('settings') || {}).showNotifications) return; if (Notification.isSupported()) new Notification({ title, body }).show() })

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize() })
ipcMain.on('window:close', () => { const settings = store.get('settings') || {}; if (settings.minimizeToTray && tray && !tray.isDestroyed()) { mainWindow?.hide(); if (process.platform === 'darwin') app.dock?.hide() } else { app.isQuitting = true; watcherManager.stop(); app.quit() } })

app.whenReady().then(() => { createWindow(); createTray(); const settings = store.get('settings') || {}; if (settings.autoMonitor) { const rules = store.get('rules') || []; setTimeout(() => { watcherManager.start(rules, mainWindow); refreshTray() }, 1500) } })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else { mainWindow?.show(); mainWindow?.focus(); if (process.platform === 'darwin') app.dock?.show() } })
app.on('window-all-closed', () => { if (tray && !tray.isDestroyed()) return; if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { app.isQuitting = true; watcherManager.stop() })
