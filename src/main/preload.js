import { contextBridge, ipcRenderer } from 'electron'

const listenerMap = new Map()

function getListenerKey(channel, callback) {
  return `${channel}:${callback?.toString?.() || 'anonymous'}`
}

contextBridge.exposeInMainWorld('automover', {
  rules: {
    getAll:  ()       => ipcRenderer.invoke('rules:getAll'),
    add:     (rule)   => ipcRenderer.invoke('rules:add', rule),
    update:  (rule)   => ipcRenderer.invoke('rules:update', rule),
    delete:  (ruleId) => ipcRenderer.invoke('rules:delete', ruleId),
    saveAll: (rules)  => ipcRenderer.invoke('rules:save', rules),
  },

  logs: {
    getAll:     ()      => ipcRenderer.invoke('logs:getAll'),
    add:        (entry) => ipcRenderer.invoke('logs:add', entry),
    markUndone: (logId) => ipcRenderer.invoke('logs:markUndone', logId),
    clear:      ()      => ipcRenderer.invoke('logs:clear'),
  },

  settings: {
    get:    ()        => ipcRenderer.invoke('settings:get'),
    update: (partial) => ipcRenderer.invoke('settings:update', partial),
  },

  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    openFolder:   () => ipcRenderer.invoke('dialog:openFolder'),
  },

  app: {
    getVersion:     ()            => ipcRenderer.invoke('app:getVersion'),
    getConfigPath:  ()            => ipcRenderer.invoke('app:getConfigPath'),
    openConfigFile: ()            => ipcRenderer.invoke('app:openConfigFile'),
    setLoginItem:   (openAtLogin) => ipcRenderer.invoke('app:setLoginItem', openAtLogin),
    getSettings:    ()            => ipcRenderer.invoke('app:getSettings'),
    saveSettings:   (settings)    => ipcRenderer.invoke('app:saveSettings', settings),
  },

  fileOps: {
    undo: (logEntry) => ipcRenderer.invoke('fileOps:undo', logEntry),
  },

  preview: {
    run:     ()      => ipcRenderer.invoke('preview:run'),
    execute: (items) => ipcRenderer.invoke('preview:execute', items),
  },

  store: {
    getRules:  ()      => ipcRenderer.invoke('store:getRules'),
    saveRules: (rules) => ipcRenderer.invoke('store:saveRules', rules),
    getLogs:   ()      => ipcRenderer.invoke('store:getLogs'),
    saveLogs:  (logs)  => ipcRenderer.invoke('store:saveLogs', logs),
  },

  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },

  watcher: {
    start:     () => ipcRenderer.invoke('watcher:start'),
    stop:      () => ipcRenderer.invoke('watcher:stop'),
    getStatus: () => ipcRenderer.invoke('watcher:getStatus'),
    runNow:    () => ipcRenderer.invoke('watcher:runNow'),
  },

  on: (channel, callback) => {
    const allowed = ['settings:changed', 'watcher:fileProcessed', 'watcher:error', 'watcher:statusChanged']
    if (!allowed.includes(channel) || typeof callback !== 'function') return
    const wrapped = (_event, ...args) => callback(...args)
    const key = getListenerKey(channel, callback)
    const oldWrapped = listenerMap.get(key)
    if (oldWrapped) ipcRenderer.removeListener(channel, oldWrapped)
    listenerMap.set(key, wrapped)
    ipcRenderer.on(channel, wrapped)
  },

  off: (channel, callback) => {
    const key = getListenerKey(channel, callback)
    const wrapped = listenerMap.get(key)
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped)
      listenerMap.delete(key)
      return
    }
    if (typeof callback === 'function') ipcRenderer.removeListener(channel, callback)
  },
})
