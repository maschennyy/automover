"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const url = require("url");
const Store = require("electron-store");
const module$1 = require("module");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
const _require = module$1.createRequire(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("index.js", document.baseURI).href);
const watcherManager = _require("./fileWatcher");
const __filename$1 = url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("index.js", document.baseURI).href);
const __dirname$1 = path.dirname(__filename$1);
const store = new Store({
  name: "automover-data",
  schema: {
    rules: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          watchFolder: { type: "string" },
          filters: {
            type: "object",
            properties: {
              extensions: { type: "array", items: { type: "string" }, default: [] },
              namePattern: { type: "string", default: "" }
            }
          },
          action: { type: "string", enum: ["move", "copy"], default: "move" },
          destination: { type: "string" },
          autoCreateFolder: { type: "boolean", default: true },
          isActive: { type: "boolean", default: true }
        },
        required: ["id", "watchFolder", "destination"]
      }
    },
    logs: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          timestamp: { type: "string" },
          ruleId: { type: "string" },
          fileName: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          action: { type: "string" },
          undone: { type: "boolean", default: false }
        },
        required: ["id", "timestamp", "fileName", "from", "to", "action"]
      }
    },
    settings: {
      type: "object",
      default: {
        autoMonitor: false,
        minimizeToTray: true,
        showNotifications: true,
        onboardingComplete: false,
        runAtStartup: false,
        trayHintShown: false
        // show "still running in tray" only once
      },
      properties: {
        autoMonitor: { type: "boolean" },
        minimizeToTray: { type: "boolean" },
        showNotifications: { type: "boolean" },
        onboardingComplete: { type: "boolean" },
        runAtStartup: { type: "boolean" },
        trayHintShown: { type: "boolean" }
      }
    }
  }
});
let mainWindow = null;
let tray = null;
function loadTrayIcon() {
  const candidates = [
    path.join(__dirname$1, "../../assets/tray-icon.png"),
    path.join(__dirname$1, "../assets/tray-icon.png"),
    path.join(electron.app.getAppPath(), "assets/tray-icon.png")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = electron.nativeImage.createFromPath(p);
      if (process.platform === "darwin") img.setTemplateImage(true);
      return img;
    }
  }
  return electron.nativeImage.createEmpty();
}
function trayTooltip() {
  const status = watcherManager.getStatus();
  if (status.isActive && status.watchingFolders.length > 0) {
    return `AutoMover — Memantau ${status.watchingFolders.length} folder`;
  }
  return "AutoMover — Nonaktif";
}
function buildTrayMenu() {
  store.get("settings");
  const isMonitoring = watcherManager.isActive;
  const menu = electron.Menu.buildFromTemplate([
    // Header row — non-interactive
    {
      label: "AutoMover",
      enabled: false
      // macOS shows this as the menu title
    },
    { type: "separator" },
    // Monitor status indicator
    {
      label: isMonitoring ? `● Memantau ${watcherManager.watchingFolders.size} folder` : "○ Monitoring Nonaktif",
      enabled: false
    },
    // Toggle monitoring
    {
      label: isMonitoring ? "Matikan Auto-Monitor" : "Aktifkan Auto-Monitor",
      type: "normal",
      click: async () => {
        if (isMonitoring) {
          store.set("settings.autoMonitor", false);
          watcherManager.stop();
        } else {
          const rules = store.get("rules");
          store.set("settings.autoMonitor", true);
          watcherManager.start(rules, mainWindow);
        }
        safeSendToRenderer("settings:changed", store.get("settings"));
        refreshTray();
      }
    },
    { type: "separator" },
    // One-Click Clean
    {
      label: "⚡ Rapihkan Sekarang",
      click: async () => {
        const { scanAndSort } = _require("./fileOps");
        const rules = store.get("rules");
        const activeRules = rules.filter((r) => r.isActive);
        const folders = [...new Set(activeRules.map((r) => r.watchFolder).filter(Boolean))];
        for (const folder of folders) {
          try {
            const result = scanAndSort(folder, activeRules);
            for (const logEntry of result.success) {
              const logs = store.get("logs");
              logs.unshift(logEntry);
              if (logs.length > 500) logs.splice(500);
              store.set("logs", logs);
              safeSendToRenderer("watcher:fileProcessed", logEntry);
            }
          } catch (err) {
            console.error("[Tray RunNow]", err.message);
          }
        }
      }
    },
    { type: "separator" },
    // Show window
    {
      label: "Buka AutoMover",
      click: () => {
        var _a;
        mainWindow == null ? void 0 : mainWindow.show();
        mainWindow == null ? void 0 : mainWindow.focus();
        if (process.platform === "darwin") (_a = electron.app.dock) == null ? void 0 : _a.show();
      }
    },
    { type: "separator" },
    // Quit
    {
      label: "Keluar",
      click: () => {
        electron.app.isQuitting = true;
        watcherManager.stop();
        electron.app.quit();
      }
    }
  ]);
  return menu;
}
function refreshTray() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(buildTrayMenu());
  tray.setToolTip(trayTooltip());
}
function safeSendToRenderer(channel, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send(channel, payload);
    }
  } catch {
  }
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    frame: false,
    transparent: false,
    backgroundColor: "#111116",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    // show after ready-to-show to avoid flash
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../../dist/index.html"));
  }
  mainWindow.on("close", (event) => {
    var _a;
    if (electron.app.isQuitting) return;
    const settings = store.get("settings");
    if (!settings.minimizeToTray) return;
    event.preventDefault();
    mainWindow.hide();
    if (process.platform === "darwin") (_a = electron.app.dock) == null ? void 0 : _a.hide();
    if (!settings.trayHintShown) {
      store.set("settings.trayHintShown", true);
      if (electron.Notification.isSupported()) {
        new electron.Notification({
          title: "AutoMover masih berjalan",
          body: "Aplikasi tetap aktif di system tray. Klik dua kali ikon tray untuk membuka kembali.",
          silent: false
        }).show();
      }
    }
    refreshTray();
  });
  mainWindow.on("show", () => refreshTray());
}
function createTray() {
  tray = new electron.Tray(loadTrayIcon());
  tray.setToolTip(trayTooltip());
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => {
    var _a;
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
    if (process.platform === "darwin") (_a = electron.app.dock) == null ? void 0 : _a.show();
  });
  tray.on("click", () => {
    if (process.platform !== "darwin") {
      tray.popUpContextMenu();
    }
  });
}
electron.ipcMain.handle("rules:getAll", () => store.get("rules"));
electron.ipcMain.handle("rules:save", (_event, rules) => {
  store.set("rules", rules);
  return { success: true };
});
electron.ipcMain.handle("rules:add", (_event, rule) => {
  const rules = store.get("rules");
  rules.push(rule);
  store.set("rules", rules);
  if (watcherManager.isActive) watcherManager.restart(rules, mainWindow);
  return { success: true, rules };
});
electron.ipcMain.handle("rules:update", (_event, updatedRule) => {
  const rules = store.get("rules");
  const idx = rules.findIndex((r) => r.id === updatedRule.id);
  if (idx === -1) return { success: false, error: "Rule not found" };
  rules[idx] = updatedRule;
  store.set("rules", rules);
  if (watcherManager.isActive) watcherManager.restart(rules, mainWindow);
  return { success: true, rules };
});
electron.ipcMain.handle("rules:delete", (_event, ruleId) => {
  const rules = store.get("rules");
  const filtered = rules.filter((r) => r.id !== ruleId);
  store.set("rules", filtered);
  if (watcherManager.isActive) watcherManager.restart(filtered, mainWindow);
  return { success: true, rules: filtered };
});
electron.ipcMain.handle("watcher:start", async () => {
  const rules = store.get("rules");
  store.set("settings.autoMonitor", true);
  safeSendToRenderer("settings:changed", store.get("settings"));
  const result = watcherManager.start(rules, mainWindow);
  refreshTray();
  return result;
});
electron.ipcMain.handle("watcher:stop", async () => {
  store.set("settings.autoMonitor", false);
  safeSendToRenderer("settings:changed", store.get("settings"));
  const result = watcherManager.stop();
  refreshTray();
  return result;
});
electron.ipcMain.handle("watcher:getStatus", async () => watcherManager.getStatus());
electron.ipcMain.handle("watcher:runNow", async () => {
  const { scanAndSort } = _require("./fileOps");
  const rules = store.get("rules");
  const activeRules = rules.filter((r) => r.isActive === true);
  const allResults = { success: [], errors: [] };
  const folders = [...new Set(activeRules.map((r) => r.watchFolder).filter(Boolean))];
  for (const folder of folders) {
    try {
      const result = scanAndSort(folder, activeRules);
      allResults.success.push(...result.success);
      allResults.errors.push(...result.errors);
      for (const logEntry of result.success) {
        const logs = store.get("logs");
        logs.unshift(logEntry);
        if (logs.length > 500) logs.splice(500);
        store.set("logs", logs);
        safeSendToRenderer("watcher:fileProcessed", logEntry);
      }
    } catch (err) {
      allResults.errors.push({ folder, error: err.message });
    }
  }
  return allResults;
});
electron.ipcMain.handle("logs:getAll", () => store.get("logs"));
electron.ipcMain.handle("logs:add", (_event, logEntry) => {
  const logs = store.get("logs");
  logs.unshift(logEntry);
  if (logs.length > 500) logs.splice(500);
  store.set("logs", logs);
  return { success: true };
});
electron.ipcMain.handle("logs:markUndone", (_event, logId) => {
  const logs = store.get("logs");
  const index = logs.findIndex((l) => l.id === logId);
  if (index === -1) return { success: false, error: "Log entry not found" };
  logs[index].undone = true;
  store.set("logs", logs);
  return { success: true };
});
electron.ipcMain.handle("logs:clear", () => {
  store.set("logs", []);
  return { success: true };
});
electron.ipcMain.handle("fileOps:undo", async (_event, logEntry) => {
  const { undoAction } = _require("./fileOps");
  try {
    const result = undoAction(logEntry);
    const logs = store.get("logs");
    const idx = logs.findIndex((l) => l.id === logEntry.id);
    if (idx !== -1) {
      logs[idx].undone = true;
      store.set("logs", logs);
    }
    return { success: true, updatedLog: result.updatedLog };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("store:getRules", () => store.get("rules"));
electron.ipcMain.handle("store:getLogs", () => store.get("logs"));
electron.ipcMain.handle("store:saveRules", (_event, rules) => {
  store.set("rules", rules);
  return { success: true };
});
electron.ipcMain.handle("store:saveLogs", (_event, logs) => {
  store.set("logs", Array.isArray(logs) ? logs.slice(0, 500) : []);
  return { success: true };
});
electron.ipcMain.handle("settings:get", () => store.get("settings"));
electron.ipcMain.handle("settings:update", (_event, partial) => {
  const updated = { ...store.get("settings"), ...partial };
  store.set("settings", updated);
  if (partial.runAtStartup !== void 0) {
    electron.app.setLoginItemSettings({ openAtLogin: partial.runAtStartup });
  }
  safeSendToRenderer("settings:changed", updated);
  return { success: true, settings: updated };
});
electron.ipcMain.handle("app:setLoginItem", async (_event, openAtLogin) => {
  electron.app.setLoginItemSettings({ openAtLogin });
  store.set("settings.runAtStartup", openAtLogin);
  return { success: true };
});
electron.ipcMain.handle("app:getVersion", async () => electron.app.getVersion());
electron.ipcMain.handle("app:getSettings", async () => {
  return store.get("settings");
});
electron.ipcMain.handle("app:saveSettings", async (_event, settings) => {
  const merged = { ...store.get("settings"), ...settings };
  store.set("settings", merged);
  if (settings.runAtStartup !== void 0) {
    electron.app.setLoginItemSettings({ openAtLogin: settings.runAtStartup });
  }
  safeSendToRenderer("settings:changed", merged);
  return { success: true };
});
electron.ipcMain.handle("app:getConfigPath", async () => store.path);
electron.ipcMain.handle("app:openConfigFile", async () => {
  electron.shell.openPath(store.path);
  return { success: true };
});
electron.ipcMain.handle("dialog:selectFolder", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Pilih Folder"
  });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});
electron.ipcMain.handle("dialog:openFolder", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Pilih Folder"
  });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});
electron.ipcMain.handle("notify", (_event, { title, body }) => {
  if (!store.get("settings").showNotifications) return;
  if (electron.Notification.isSupported()) new electron.Notification({ title, body }).show();
});
electron.ipcMain.on("window:minimize", () => mainWindow == null ? void 0 : mainWindow.minimize());
electron.ipcMain.on("window:maximize", () => {
  (mainWindow == null ? void 0 : mainWindow.isMaximized()) ? mainWindow.unmaximize() : mainWindow == null ? void 0 : mainWindow.maximize();
});
electron.ipcMain.on("window:close", () => {
  var _a;
  const settings = store.get("settings");
  if (settings.minimizeToTray && tray && !tray.isDestroyed()) {
    mainWindow == null ? void 0 : mainWindow.hide();
    if (process.platform === "darwin") (_a = electron.app.dock) == null ? void 0 : _a.hide();
  } else {
    electron.app.isQuitting = true;
    watcherManager.stop();
    electron.app.quit();
  }
});
electron.app.whenReady().then(() => {
  createWindow();
  createTray();
  const settings = store.get("settings");
  if (settings.minimizeToTray && process.platform === "darwin") ;
  if (settings.autoMonitor) {
    const rules = store.get("rules");
    setTimeout(() => {
      watcherManager.start(rules, mainWindow);
      refreshTray();
    }, 1500);
  }
});
electron.app.on("activate", () => {
  var _a;
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
    if (process.platform === "darwin") (_a = electron.app.dock) == null ? void 0 : _a.show();
  }
});
electron.app.on("window-all-closed", () => {
  if (tray && !tray.isDestroyed()) return;
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  electron.app.isQuitting = true;
  watcherManager.stop();
});
//# sourceMappingURL=index.js.map
