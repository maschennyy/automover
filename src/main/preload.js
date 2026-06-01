import { contextBridge, ipcRenderer } from 'electron'

/**
 * AutoMover Preload Script
 * Exposes a typed, safe API surface to the renderer via contextBridge.
 * The renderer NEVER has direct access to ipcRenderer or Node.js APIs.
 */
contextBridge.exposeInMainWorld('automover', {

  // ── Rules ───────────────────────────────────────────────────────────────────
  rules: {
    getAll:  ()           => ipcRenderer.invoke('rules:getAll'),
    add:     (rule)       => ipcRenderer.invoke('rules:add',    rule),
    update:  (rule)       => ipcRenderer.invoke('rules:update', rule),
    delete:  (ruleId)     => ipcRenderer.invoke('rules:delete', ruleId),
    saveAll: (rules)      => ipcRenderer.invoke('rules:save',   rules),
  },

  // ── Logs ────────────────────────────────────────────────────────────────────
  logs: {
    getAll:    ()        => ipcRenderer.invoke('logs:getAll'),
    add:       (entry)   => ipcRenderer.invoke('logs:add',       entry),
    markUndone:(logId)   => ipcRenderer.invoke('logs:markUndone', logId),
    clear:     ()        => ipcRenderer.invoke('logs:clear'),
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: {
    get:    ()        => ipcRenderer.invoke('settings:get'),
    update: (partial) => ipcRenderer.invoke('settings:update', partial),
  },

  // ── Dialog ──────────────────────────────────────────────────────────────────
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    openFolder:   () => ipcRenderer.invoke('dialog:openFolder'),   // alias used by RuleBuilder
  },

  // ── App-level ────────────────────────────────────────────────────────────────
  app: {
    getVersion:     ()             => ipcRenderer.invoke('app:getVersion'),
    getConfigPath:  ()             => ipcRenderer.invoke('app:getConfigPath'),
    openConfigFile: ()             => ipcRenderer.invoke('app:openConfigFile'),
    setLoginItem:   (openAtLogin)  => ipcRenderer.invoke('app:setLoginItem',  openAtLogin),
    getSettings:    ()             => ipcRenderer.invoke('app:getSettings'),
    saveSettings:   (settings)     => ipcRenderer.invoke('app:saveSettings',  settings),
  },

  // ── FileOps (Undo) ────────────────────────────────────────────────────────────
  fileOps: {
    undo: (logEntry) => ipcRenderer.invoke('fileOps:undo', logEntry),
  },

  // ── Store (direct bulk save — used by RuleList after mutations) ──────────────
  store: {
    getRules:  ()      => ipcRenderer.invoke('store:getRules'),
    saveRules: (rules) => ipcRenderer.invoke('store:saveRules', rules),
    getLogs:   ()      => ipcRenderer.invoke('store:getLogs'),
    saveLogs:  (logs)  => ipcRenderer.invoke('store:saveLogs',  logs),
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),

  // ── Window Controls ──────────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },

  // ── Watcher ──────────────────────────────────────────────────────────────────
  watcher: {
    start:     ()  => ipcRenderer.invoke('watcher:start'),
    stop:      ()  => ipcRenderer.invoke('watcher:stop'),
    getStatus: ()  => ipcRenderer.invoke('watcher:getStatus'),
    runNow:    ()  => ipcRenderer.invoke('watcher:runNow'),
  },

  // ── Event Listeners (main → renderer) ────────────────────────────────────────
  on: (channel, callback) => {
    const allowed = [
      'settings:changed',
      'watcher:fileProcessed',
      'watcher:error',
      'watcher:statusChanged',
    ]
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  },
})