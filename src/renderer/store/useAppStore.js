import { create } from 'zustand'

/**
 * AutoMover — Central Zustand Store
 */
const useAppStore = create((set, get) => ({
  rules: [],

  fetchRules: async () => {
    const rules = await window.automover.rules.getAll()
    set({ rules: rules ?? [] })
  },

  addRule: async (rule) => {
    const result = await window.automover.rules.add(rule)
    if (result.success) set({ rules: result.rules })
    return result
  },

  updateRule: async (updatedRule) => {
    const result = await window.automover.rules.update(updatedRule)
    if (result.success) set({ rules: result.rules })
    return result
  },

  deleteRule: async (ruleId) => {
    const result = await window.automover.rules.delete(ruleId)
    if (result.success) set({ rules: result.rules })
    return result
  },

  toggleRule: async (ruleId) => {
    const rule = get().rules.find(r => r.id === ruleId)
    if (!rule) return
    return get().updateRule({ ...rule, isActive: !rule.isActive })
  },

  logs: [],

  fetchLogs: async () => {
    const logs = await window.automover.logs.getAll()
    set({ logs: logs ?? [] })
  },

  addLog: async (entry) => {
    await window.automover.logs.add(entry)
    set(state => ({ logs: [entry, ...state.logs].slice(0, 500) }))
  },

  markLogUndone: async (logId) => {
    set(state => ({ logs: state.logs.map(l => l.id === logId ? { ...l, undone: true } : l) }))
    await window.automover.logs.markUndone(logId)
  },

  markLogAsUndone: async (logId) => get().markLogUndone(logId),

  clearLogs: async () => {
    set({ logs: [] })
    await window.automover.logs.clear()
  },

  clearAllLogs: async () => get().clearLogs(),

  settings: {
    autoMonitor: false,
    minimizeToTray: true,
    showNotifications: true,
    onboardingComplete: false,
    theme: 'dark',
  },

  fetchSettings: async () => {
    const settings = await window.automover.settings.get()
    set({ settings: { ...get().settings, ...(settings ?? {}) } })
  },

  updateSettings: async (partial) => {
    const result = await window.automover.settings.update(partial)
    if (result.success) set({ settings: { ...get().settings, ...result.settings } })
    return result
  },

  setTheme: async (theme) => {
    const nextTheme = theme === 'light' ? 'light' : 'dark'
    return get().updateSettings({ theme: nextTheme })
  },

  isWatcherActive: false,
  watchingFolders: [],

  setWatcherActive: (isActive, watchingFolders = []) => set({ isWatcherActive: isActive, watchingFolders }),

  startWatcher: async () => {
    try {
      const result = await window.automover.watcher.start()
      if (result.success) {
        set({ isWatcherActive: result.isActive, watchingFolders: result.watchingFolders ?? [] })
        await window.automover.settings.update({ autoMonitor: true })
      }
      return result
    } catch (err) {
      get().setGlobalError(`Gagal memulai monitoring: ${err.message}`)
    }
  },

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

  runNow: async () => {
    set(state => ({ ui: { ...state.ui, isLoading: true } }))
    try {
      return await window.automover.watcher.runNow()
    } catch (err) {
      get().setGlobalError(`Gagal menjalankan sortir: ${err.message}`)
    } finally {
      set(state => ({ ui: { ...state.ui, isLoading: false } }))
    }
  },

  toasts: [],

  addToast: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set(state => ({ toasts: [...state.toasts, { id, type, message }] }))
    setTimeout(() => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })), 4000)
  },

  dismissToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  ui: {
    activeTab: 'rules',
    ruleModalOpen: false,
    editingRule: null,
    onboardingOpen: false,
    isLoading: false,
    globalError: null,
  },

  setActiveTab: (tab) => set(state => ({ ui: { ...state.ui, activeTab: tab } })),
  openRuleModal: (rule = null) => set(state => ({ ui: { ...state.ui, ruleModalOpen: true, editingRule: rule } })),
  closeRuleModal: () => set(state => ({ ui: { ...state.ui, ruleModalOpen: false, editingRule: null } })),
  openOnboarding: () => set(state => ({ ui: { ...state.ui, onboardingOpen: true } })),
  closeOnboarding: () => set(state => ({ ui: { ...state.ui, onboardingOpen: false } })),
  setLoading: (isLoading) => set(state => ({ ui: { ...state.ui, isLoading } })),
  setGlobalError: (message) => set(state => ({ ui: { ...state.ui, globalError: message } })),
  clearGlobalError: () => set(state => ({ ui: { ...state.ui, globalError: null } })),

  bootstrap: async () => {
    set(state => ({ ui: { ...state.ui, isLoading: true } }))
    try {
      await Promise.all([get().fetchRules(), get().fetchLogs(), get().fetchSettings()])
      const settings = get().settings
      if (!settings.onboardingComplete) get().openOnboarding()
    } catch (err) {
      get().setGlobalError(`Gagal memuat data: ${err.message}`)
    } finally {
      set(state => ({ ui: { ...state.ui, isLoading: false } }))
    }

    window.automover.on('settings:changed', (newSettings) => {
      set({ settings: { ...get().settings, ...(newSettings ?? {}) } })
    })

    window.automover.on('watcher:fileProcessed', async (logEntry) => {
      set(state => ({ logs: [logEntry, ...state.logs].slice(0, 500) }))
      const actionText = logEntry.action === 'copy' ? 'disalin' : logEntry.action === 'skip' ? 'dilewati' : 'dipindahkan'
      get().addToast('success', `✓ ${logEntry.fileName} ${actionText}`)
    })

    window.automover.on('watcher:error', (errorInfo) => get().addToast('error', errorInfo.message))

    window.automover.on('watcher:statusChanged', ({ isActive, watchingFolders }) => {
      set({ isWatcherActive: isActive, watchingFolders: watchingFolders ?? [] })
    })

    try {
      const status = await window.automover.watcher.getStatus()
      set({ isWatcherActive: status.isActive, watchingFolders: status.watchingFolders ?? [] })
    } catch {}
  },
}))

export default useAppStore
