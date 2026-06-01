import { create } from 'zustand'

/**
 * AutoMover — Central Zustand Store
 *
 * Serves as the single source of truth for the renderer process.
 * Data is persisted via electron-store (main process); this store
 * is hydrated on app load and synced back via IPC on mutations.
 *
 * State slices:
 *  - rules    : sorting rules
 *  - logs     : activity log entries
 *  - settings : app-wide settings
 *  - ui       : transient UI state (modals, active tab, loading flags)
 */

// ─── Type Definitions (JSDoc) ─────────────────────────────────────────────────
/**
 * @typedef {Object} Rule
 * @property {string}   id
 * @property {string}   name
 * @property {string}   watchFolder
 * @property {{ extensions: string[], namePattern: string }} filters
 * @property {'move'|'copy'} action
 * @property {string}   destination
 * @property {boolean}  autoCreateFolder
 * @property {boolean}  isActive
 */

/**
 * @typedef {Object} LogEntry
 * @property {string}  id
 * @property {string}  timestamp
 * @property {string}  ruleId
 * @property {string}  fileName
 * @property {string}  from
 * @property {string}  to
 * @property {'move'|'copy'} action
 * @property {boolean} undone
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} autoMonitor
 * @property {boolean} minimizeToTray
 * @property {boolean} showNotifications
 * @property {boolean} onboardingComplete
 */

// ─── Store ────────────────────────────────────────────────────────────────────
const useAppStore = create((set, get) => ({

  // ── Rules Slice ─────────────────────────────────────────────────────────────
  /** @type {Rule[]} */
  rules: [],

  /** Load all rules from electron-store (main process) */
  fetchRules: async () => {
    const rules = await window.automover.rules.getAll()
    set({ rules: rules ?? [] })
  },

  /** Add a new rule and persist */
  addRule: async (rule) => {
    const result = await window.automover.rules.add(rule)
    if (result.success) {
      set({ rules: result.rules })
    }
    return result
  },

  /** Update an existing rule and persist */
  updateRule: async (updatedRule) => {
    const result = await window.automover.rules.update(updatedRule)
    if (result.success) {
      set({ rules: result.rules })
    }
    return result
  },

  /** Delete a rule by id and persist */
  deleteRule: async (ruleId) => {
    const result = await window.automover.rules.delete(ruleId)
    if (result.success) {
      set({ rules: result.rules })
    }
    return result
  },

  /** Toggle rule active/inactive */
  toggleRule: async (ruleId) => {
    const rules       = get().rules
    const rule        = rules.find(r => r.id === ruleId)
    if (!rule) return

    const updated     = { ...rule, isActive: !rule.isActive }
    return get().updateRule(updated)
  },

  // ── Logs Slice ──────────────────────────────────────────────────────────────
  /** @type {LogEntry[]} */
  logs: [],

  /** Load all logs from electron-store */
  fetchLogs: async () => {
    const logs = await window.automover.logs.getAll()
    set({ logs: logs ?? [] })
  },

  /** Prepend a new log entry (called after a file operation) */
  addLog: async (entry) => {
    await window.automover.logs.add(entry)
    set(state => ({ logs: [entry, ...state.logs].slice(0, 500) }))
  },

  /** Mark a log entry as undone (after undo action) — persists to electron-store */
  markLogUndone: async (logId) => {
    // Optimistic update first (instant UI response)
    set(state => ({
      logs: state.logs.map(l =>
        l.id === logId ? { ...l, undone: true } : l
      ),
    }))
    // Then persist via the dedicated IPC handler
    await window.automover.logs.markUndone(logId)
  },

  /**
   * Alias kept for compatibility with ActivityLog.jsx which calls markLogUndone.
   * Identical behaviour — calls same IPC path.
   */
  markLogAsUndone: async (logId) => {
    return get().markLogUndone(logId)
  },

  /** Clear all logs — persists to electron-store */
  clearLogs: async () => {
    set({ logs: [] })
    await window.automover.logs.clear()
  },

  /** Clear all logs (alias) */
  clearAllLogs: async () => {
    return get().clearLogs()
  },

  // ── Settings Slice ───────────────────────────────────────────────────────────
  /** @type {Settings} */
  settings: {
    autoMonitor:        false,
    minimizeToTray:     true,
    showNotifications:  true,
    onboardingComplete: false,
  },

  /** Load settings from electron-store */
  fetchSettings: async () => {
    const settings = await window.automover.settings.get()
    set({ settings: settings ?? get().settings })
  },

  /** Update one or more settings fields */
  updateSettings: async (partial) => {
    const result = await window.automover.settings.update(partial)
    if (result.success) {
      set({ settings: result.settings })
    }
    return result
  },

  // ── Watcher Slice ────────────────────────────────────────────────────────────
  /** Whether the background file watcher is currently running */
  isWatcherActive:    false,

  /** Folders currently being watched */
  watchingFolders:    [],

  /** Set watcher running state (called from IPC listener or IPC response) */
  setWatcherActive: (isActive, watchingFolders = []) => set({
    isWatcherActive: isActive,
    watchingFolders,
  }),

  /**
   * Start the background watcher via IPC.
   * Updates local state on success.
   */
  startWatcher: async () => {
    try {
      const result = await window.automover.watcher.start()
      if (result.success) {
        set({ isWatcherActive: result.isActive, watchingFolders: result.watchingFolders ?? [] })
        // Persist to settings so next app launch auto-resumes
        await window.automover.settings.update({ autoMonitor: true })
      }
      return result
    } catch (err) {
      get().setGlobalError(`Gagal memulai monitoring: ${err.message}`)
    }
  },

  /**
   * Stop the background watcher via IPC.
   */
  stopWatcher: async () => {
    try {
      const result = await window.automover.watcher.stop()
      set({ isWatcherActive: false, watchingFolders: [] })
      await window.automover.settings.update({ autoMonitor: false })
      return result
    } catch (err) {
      get().setGlobalError(`Gagal menghentikan monitoring: ${err.message}`)
    }
  },

  /**
   * Run "One-Click Clean" — scan all watchFolders immediately.
   * Does not require background watcher to be active.
   */
  runNow: async () => {
    set(state => ({ ui: { ...state.ui, isLoading: true } }))
    try {
      const result = await window.automover.watcher.runNow()
      // Logs pushed via IPC event — no need to manually add here
      return result
    } catch (err) {
      get().setGlobalError(`Gagal menjalankan sortir: ${err.message}`)
    } finally {
      set(state => ({ ui: { ...state.ui, isLoading: false } }))
    }
  },

  // ── Toast / Error Banner Slice ───────────────────────────────────────────────
  /** @type {{ id: string, type: 'success'|'error'|'info', message: string }[]} */
  toasts: [],

  addToast: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set(state => ({ toasts: [...state.toasts, { id, type, message }] }))
    // Auto-dismiss after 4s
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },

  dismissToast: (id) => set(state => ({
    toasts: state.toasts.filter(t => t.id !== id),
  })),

  // ── UI Slice ─────────────────────────────────────────────────────────────────
  ui: {
    activeTab:         'rules',   // 'rules' | 'logs' | 'settings'
    ruleModalOpen:     false,
    editingRule:       null,      // Rule | null — null = new rule mode
    onboardingOpen:    false,
    isLoading:         false,
    globalError:       null,
  },

  setActiveTab: (tab) => set(state => ({
    ui: { ...state.ui, activeTab: tab },
  })),

  openRuleModal: (rule = null) => set(state => ({
    ui: { ...state.ui, ruleModalOpen: true, editingRule: rule },
  })),

  closeRuleModal: () => set(state => ({
    ui: { ...state.ui, ruleModalOpen: false, editingRule: null },
  })),

  openOnboarding: () => set(state => ({
    ui: { ...state.ui, onboardingOpen: true },
  })),

  closeOnboarding: () => set(state => ({
    ui: { ...state.ui, onboardingOpen: false },
  })),

  setLoading: (isLoading) => set(state => ({
    ui: { ...state.ui, isLoading },
  })),

  setGlobalError: (message) => set(state => ({
    ui: { ...state.ui, globalError: message },
  })),

  clearGlobalError: () => set(state => ({
    ui: { ...state.ui, globalError: null },
  })),

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  /**
   * Called once on app mount.
   * Hydrates all state slices from electron-store and registers IPC listeners.
   */
  bootstrap: async () => {
    set(state => ({ ui: { ...state.ui, isLoading: true } }))

    try {
      await Promise.all([
        get().fetchRules(),
        get().fetchLogs(),
        get().fetchSettings(),
      ])

      // Show onboarding if first run
      const settings = get().settings
      if (!settings.onboardingComplete) {
        get().openOnboarding()
      }
    } catch (err) {
      get().setGlobalError(`Gagal memuat data: ${err.message}`)
    } finally {
      set(state => ({ ui: { ...state.ui, isLoading: false } }))
    }

    // Register push events from main process
    window.automover.on('settings:changed', (newSettings) => {
      set({ settings: newSettings })
    })

    window.automover.on('watcher:fileProcessed', async (logEntry) => {
      // Prepend to logs (already persisted in main process)
      set(state => ({ logs: [logEntry, ...state.logs].slice(0, 500) }))
      get().addToast('success', `✓ ${logEntry.fileName} dipindahkan`)
    })

    window.automover.on('watcher:error', (errorInfo) => {
      get().addToast('error', errorInfo.message)
    })

    window.automover.on('watcher:statusChanged', ({ isActive, watchingFolders }) => {
      set({ isWatcherActive: isActive, watchingFolders: watchingFolders ?? [] })
    })

    // Hydrate watcher status from main process
    try {
      const status = await window.automover.watcher.getStatus()
      set({ isWatcherActive: status.isActive, watchingFolders: status.watchingFolders ?? [] })
    } catch {
      // Non-fatal — watcher status will update via event
    }
  },   // end bootstrap
}))

export default useAppStore