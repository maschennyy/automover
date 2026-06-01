"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("automover", {
  // ── Rules ───────────────────────────────────────────────────────────────────
  rules: {
    getAll: () => electron.ipcRenderer.invoke("rules:getAll"),
    add: (rule) => electron.ipcRenderer.invoke("rules:add", rule),
    update: (rule) => electron.ipcRenderer.invoke("rules:update", rule),
    delete: (ruleId) => electron.ipcRenderer.invoke("rules:delete", ruleId),
    saveAll: (rules) => electron.ipcRenderer.invoke("rules:save", rules)
  },
  // ── Logs ────────────────────────────────────────────────────────────────────
  logs: {
    getAll: () => electron.ipcRenderer.invoke("logs:getAll"),
    add: (entry) => electron.ipcRenderer.invoke("logs:add", entry),
    markUndone: (logId) => electron.ipcRenderer.invoke("logs:markUndone", logId),
    clear: () => electron.ipcRenderer.invoke("logs:clear")
  },
  // ── Settings ─────────────────────────────────────────────────────────────
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    update: (partial) => electron.ipcRenderer.invoke("settings:update", partial)
  },
  // ── Dialog ──────────────────────────────────────────────────────────────────
  dialog: {
    selectFolder: () => electron.ipcRenderer.invoke("dialog:selectFolder"),
    openFolder: () => electron.ipcRenderer.invoke("dialog:openFolder")
    // alias used by RuleBuilder
  },
  // ── App-level ────────────────────────────────────────────────────────────────
  app: {
    getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
    getConfigPath: () => electron.ipcRenderer.invoke("app:getConfigPath"),
    openConfigFile: () => electron.ipcRenderer.invoke("app:openConfigFile"),
    setLoginItem: (openAtLogin) => electron.ipcRenderer.invoke("app:setLoginItem", openAtLogin),
    getSettings: () => electron.ipcRenderer.invoke("app:getSettings"),
    saveSettings: (settings) => electron.ipcRenderer.invoke("app:saveSettings", settings)
  },
  // ── FileOps (Undo) ────────────────────────────────────────────────────────────
  fileOps: {
    undo: (logEntry) => electron.ipcRenderer.invoke("fileOps:undo", logEntry)
  },
  // ── Store (direct bulk save — used by RuleList after mutations) ──────────────
  store: {
    getRules: () => electron.ipcRenderer.invoke("store:getRules"),
    saveRules: (rules) => electron.ipcRenderer.invoke("store:saveRules", rules),
    getLogs: () => electron.ipcRenderer.invoke("store:getLogs"),
    saveLogs: (logs) => electron.ipcRenderer.invoke("store:saveLogs", logs)
  },
  // ── Notifications ────────────────────────────────────────────────────────────
  notify: (title, body) => electron.ipcRenderer.invoke("notify", { title, body }),
  // ── Window Controls ──────────────────────────────────────────────────────────
  window: {
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    maximize: () => electron.ipcRenderer.send("window:maximize"),
    close: () => electron.ipcRenderer.send("window:close")
  },
  // ── Watcher ──────────────────────────────────────────────────────────────────
  watcher: {
    start: () => electron.ipcRenderer.invoke("watcher:start"),
    stop: () => electron.ipcRenderer.invoke("watcher:stop"),
    getStatus: () => electron.ipcRenderer.invoke("watcher:getStatus"),
    runNow: () => electron.ipcRenderer.invoke("watcher:runNow")
  },
  // ── Event Listeners (main → renderer) ────────────────────────────────────────
  on: (channel, callback) => {
    const allowed = [
      "settings:changed",
      "watcher:fileProcessed",
      "watcher:error",
      "watcher:statusChanged"
    ];
    if (allowed.includes(channel)) {
      electron.ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => {
    electron.ipcRenderer.removeListener(channel, callback);
  }
});
//# sourceMappingURL=preload.js.map
