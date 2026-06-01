"use strict";
const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const { Notification } = require("electron");
const {
  moveFile,
  copyFile,
  matchesRule
} = require("./fileOps");
function folderDisplayName(folderPath) {
  return path.basename(folderPath) || folderPath;
}
function sendNotification(fileName, destinationDir) {
  try {
    if (!Notification.isSupported()) return;
    new Notification({
      title: "AutoMover",
      body: `✓ ${fileName} → ${folderDisplayName(destinationDir)}`,
      silent: false
    }).show();
  } catch {
  }
}
function safeSend(mainWindow, channel, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send(channel, payload);
    }
  } catch {
  }
}
class WatcherManager {
  constructor() {
    this.watchers = /* @__PURE__ */ new Map();
    this.isActive = false;
    this._rules = [];
    this._mainWindow = null;
  }
  /**
   * Start watching all unique watchFolders from active rules.
   * @param {Object[]} rules
   * @param {Electron.BrowserWindow} mainWindow
   * @returns {{ success: true, watchingFolders: string[] }}
   */
  start(rules, mainWindow) {
    this._mainWindow = mainWindow;
    this._rules = rules;
    const activeRules = rules.filter((r) => r.isActive === true);
    const uniqueFolders = [...new Set(activeRules.map((r) => r.watchFolder).filter(Boolean))];
    for (const folder of uniqueFolders) {
      if (this.watchers.has(folder)) continue;
      if (!fs.existsSync(folder)) {
        console.warn(`[AutoMover Watcher] Folder tidak ditemukan, dilewati: "${folder}"`);
        safeSend(mainWindow, "watcher:error", {
          message: `Folder tidak ditemukan: "${folder}"`,
          filePath: folder
        });
        continue;
      }
      this._createWatcher(folder, mainWindow);
    }
    for (const [watchedFolder] of this.watchers) {
      if (!uniqueFolders.includes(watchedFolder)) {
        this._closeWatcher(watchedFolder);
      }
    }
    this.isActive = this.watchers.size > 0;
    const status = this.getStatus();
    safeSend(mainWindow, "watcher:statusChanged", status);
    return { success: true, ...status };
  }
  /**
   * Stop all active watchers and clean up resources.
   * @returns {{ success: true }}
   */
  stop() {
    for (const [folder] of this.watchers) {
      this._closeWatcher(folder);
    }
    this.isActive = false;
    this._rules = [];
    const status = this.getStatus();
    safeSend(this._mainWindow, "watcher:statusChanged", status);
    return { success: true };
  }
  /**
   * Stop and restart with a fresh rules set.
   * Call when rules change while watcher is running.
   * @param {Object[]} rules
   * @param {Electron.BrowserWindow} mainWindow
   * @returns {{ success: true, watchingFolders: string[] }}
   */
  restart(rules, mainWindow) {
    this.stop();
    return this.start(rules, mainWindow);
  }
  /**
   * @returns {{ isActive: boolean, watchingFolders: string[] }}
   */
  getStatus() {
    return {
      isActive: this.isActive,
      watchingFolders: [...this.watchers.keys()]
    };
  }
  /**
   * Update the internal rules snapshot without restarting watchers.
   * Useful when a rule's filters/destination change but watchFolder is the same.
   * For watchFolder changes, call restart() instead.
   * @param {Object[]} rules
   */
  updateRules(rules) {
    this._rules = rules;
  }
  // ─── Private ────────────────────────────────────────────────────────────────
  _createWatcher(folder, mainWindow) {
    const watcher = chokidar.watch(folder, {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      // non-recursive: top-level only
      awaitWriteFinish: {
        stabilityThreshold: 1e3,
        // wait 1s of no file-size change
        pollInterval: 100
      },
      ignored: /(^|[/\\])\../,
      // ignore hidden / dotfiles
      usePolling: false,
      interval: 300,
      binaryInterval: 600
    });
    watcher.on("add", (filePath) => {
      this._handleNewFile(filePath, folder, mainWindow);
    });
    watcher.on("error", (err) => {
      console.error(`[AutoMover Watcher] Chokidar error on "${folder}":`, err);
      safeSend(mainWindow, "watcher:error", {
        message: `Watcher error pada "${folder}": ${err.message}`,
        filePath: folder
      });
    });
    this.watchers.set(folder, watcher);
    console.log(`[AutoMover Watcher] Memantau: "${folder}"`);
  }
  _closeWatcher(folder) {
    const watcher = this.watchers.get(folder);
    if (watcher) {
      watcher.close().catch(() => {
      });
      this.watchers.delete(folder);
      console.log(`[AutoMover Watcher] Berhenti memantau: "${folder}"`);
    }
  }
  _handleNewFile(filePath, watchFolder, mainWindow) {
    const fileName = path.basename(filePath);
    try {
      if (!fs.statSync(filePath).isFile()) return;
    } catch {
      return;
    }
    const applicableRules = this._rules.filter(
      (r) => r.isActive === true && r.watchFolder && path.resolve(r.watchFolder) === path.resolve(watchFolder)
    );
    for (const rule of applicableRules) {
      if (!matchesRule(fileName, rule)) continue;
      try {
        let logEntry;
        if (rule.action === "copy") {
          logEntry = copyFile(filePath, rule.destination, rule);
        } else {
          logEntry = moveFile(filePath, rule.destination, rule);
        }
        safeSend(mainWindow, "watcher:fileProcessed", logEntry);
        sendNotification(logEntry.fileName, rule.destination);
        if (rule.action === "move") break;
      } catch (err) {
        console.error(
          `[AutoMover Watcher] Error memproses "${fileName}" rule "${rule.id}":`,
          err.message
        );
        safeSend(mainWindow, "watcher:error", {
          message: `Gagal memproses "${fileName}": ${err.message}`,
          filePath,
          ruleId: rule.id
        });
        try {
          fs.statSync(filePath);
        } catch {
          break;
        }
      }
    }
  }
}
const watcherManager = new WatcherManager();
module.exports = watcherManager;
//# sourceMappingURL=fileWatcher.js.map
