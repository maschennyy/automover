import { useEffect, useState, Component } from 'react'
import useAppStore   from './store/useAppStore'
import RuleList      from './components/RuleList'
import RuleBuilder   from './components/RuleBuilder'
import ActivityLog   from './components/ActivityLog'
import TrayMenu      from './components/TrayMenu'

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // Log to console — in production you could also write to a log file via IPC
    console.error('[AutoMover ErrorBoundary] Unhandled error:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        height:         '100vh',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'var(--bg-base)',
        color:          'var(--text-primary)',
        gap:            16,
        padding:        40,
        textAlign:      'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Terjadi Kesalahan Tak Terduga
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, maxWidth: 400 }}>
            AutoMover mengalami error internal. Data dan file Anda tidak terpengaruh.
          </p>
        </div>
        {this.state.error && (
          <code style={{
            background:   'var(--bg-elevated)',
            border:       '1px solid var(--border-default)',
            borderRadius: 8,
            padding:      '10px 16px',
            fontSize:     11,
            fontFamily:   'JetBrains Mono, monospace',
            color:        'var(--danger)',
            maxWidth:     500,
            wordBreak:    'break-word',
            textAlign:    'left',
          }}>
            {this.state.error.message}
          </code>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{
              padding:      '9px 20px',
              borderRadius: 8,
              border:       '1px solid var(--border-default)',
              background:   'transparent',
              color:        'var(--text-secondary)',
              fontSize:     13,
              cursor:       'pointer',
              fontFamily:   'DM Sans, sans-serif',
            }}
          >
            Coba Lagi
          </button>
          <button
            onClick={() => window.automover?.window?.close?.()}
            style={{
              padding:      '9px 20px',
              borderRadius: 8,
              border:       'none',
              background:   'var(--accent)',
              color:        '#fff',
              fontSize:     13,
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   'DM Sans, sans-serif',
            }}
          >
            Tutup Aplikasi
          </button>
        </div>
      </div>
    )
  }
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    icon:  '📂',
    title: 'Pilih Folder yang Dipantau',
    desc:  'Tentukan folder seperti "Downloads" yang ingin dijaga tetap rapi. AutoMover akan memantau folder ini secara real-time.',
  },
  {
    icon:  '⚙️',
    title: 'Buat Aturan Sortir',
    desc:  'Tentukan: file berekstensi apa, harus dipindahkan ke mana. Contoh: semua .pdf → folder "Dokumen/PDF".',
  },
  {
    icon:  '⚡',
    title: 'Aktifkan Auto-Monitor',
    desc:  'Nyalakan Auto-Monitor dan biarkan AutoMover bekerja di background. Setiap file baru akan langsung disortir otomatis.',
  },
]

function OnboardingModal({ onStart, onSkip }) {
  const [step, setStep] = useState(0)
  const current = ONBOARDING_STEPS[step]
  const isLast  = step === ONBOARDING_STEPS.length - 1

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         500,
      background:     'rgba(0,0,0,0.65)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background:    'var(--bg-elevated)',
        border:        '1px solid var(--border-default)',
        borderRadius:  'var(--radius-xl)',
        padding:       '36px 36px 28px',
        width:         420,
        boxShadow:     '0 24px 80px rgba(0,0,0,0.6)',
        animation:     'fadeIn 0.2s ease',
        display:       'flex',
        flexDirection: 'column',
        gap:           20,
      }}>
        {/* Step indicator dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <span key={i} style={{
              width:        i === step ? 20 : 6,
              height:       6,
              borderRadius: 99,
              background:   i === step ? 'var(--accent)' : 'var(--border-strong)',
              transition:   'width 0.2s, background 0.2s',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.2s ease' }} key={step}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 16 }}>{current.icon}</div>
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontSize:   18,
            fontWeight: 700,
            marginBottom: 10,
            color:      'var(--text-primary)',
          }}>
            {current.title}
          </h2>
          <p style={{
            fontSize:   13,
            color:      'var(--text-secondary)',
            lineHeight: 1.7,
          }}>
            {current.desc}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {isLast ? (
            <button
              type="button"
              onClick={onStart}
              style={{
                padding:      '11px 0',
                borderRadius: 'var(--radius)',
                border:       'none',
                background:   'var(--accent)',
                color:        '#fff',
                fontSize:     14,
                fontWeight:   700,
                cursor:       'pointer',
                fontFamily:   'Syne, sans-serif',
              }}
            >
              ✦ Mulai Buat Aturan Pertama
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              style={{
                padding:      '11px 0',
                borderRadius: 'var(--radius)',
                border:       'none',
                background:   'var(--accent)',
                color:        '#fff',
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   'DM Sans, sans-serif',
              }}
            >
              Selanjutnya →
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            style={{
              padding:    '8px 0',
              background: 'none',
              border:     'none',
              color:      'var(--text-muted)',
              fontSize:   12,
              cursor:     'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Lewati, saya sudah tahu caranya
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconRules    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
const IconLogs     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg>
const IconSettings = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
const IconMinus    = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="5.5" width="10" height="1.2" rx="0.6"/></svg>
const IconSquare   = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg>
const IconX        = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5"/></svg>

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'rules',    label: 'Aturan',     Icon: IconRules    },
  { id: 'logs',     label: 'Riwayat',    Icon: IconLogs     },
  { id: 'settings', label: 'Pengaturan', Icon: IconSettings },
]

// ─── Panels ───────────────────────────────────────────────────────────────────
// ─── Rules section — wraps RuleList + RuleBuilder side-by-side ────────────────
function RulesSection() {
  const { addRule, updateRule } = useAppStore()

  // null = panel closed | undefined = create mode | Rule object = edit mode
  const [editingRule, setEditingRule] = useState(null)
  const [panelOpen, setPanelOpen]     = useState(false)

  const openCreate = () => {
    setEditingRule(undefined)  // undefined = create mode, distinct from null (closed)
    setPanelOpen(true)
  }

  const openEdit = (rule) => {
    setEditingRule(rule)
    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    // Slight delay so the slide-out animation can complete before clearing state
    setTimeout(() => setEditingRule(null), 200)
  }

  const handleSave = async (rule) => {
    if (editingRule && editingRule.id) {
      // Edit mode: update existing
      await updateRule(rule)
    } else {
      // Create mode: add new
      await addRule(rule)
    }
    closePanel()
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left: rule list */}
      <div style={{
        flex:       panelOpen ? '0 0 52%' : '1',
        minWidth:   0,
        display:    'flex',
        flexDirection: 'column',
        overflow:   'hidden',
        transition: 'flex 0.25s ease',
        borderRight: panelOpen ? '1px solid var(--border-subtle)' : 'none',
      }}>
        <RuleList onAddNew={openCreate} onEdit={openEdit} />
      </div>

      {/* Right: rule builder panel */}
      <div style={{
        flex:       panelOpen ? '0 0 48%' : '0 0 0px',
        overflow:   'hidden',
        transition: 'flex 0.25s ease',
        minWidth:   0,
      }}>
        {panelOpen && (
          <RuleBuilder
            rule={editingRule ?? null}
            onSave={handleSave}
            onCancel={closePanel}
          />
        )}
      </div>
    </div>
  )
}

// ─── Toast Notification Component ────────────────────────────────────────────
function ToastList() {
  const { toasts, dismissToast } = useAppStore()
  if (toasts.length === 0) return null

  return (
    <div style={{
      position:      'fixed',
      bottom:        20,
      right:         20,
      zIndex:        999,
      display:       'flex',
      flexDirection: 'column',
      gap:           8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            pointerEvents:  'all',
            display:        'flex',
            alignItems:     'center',
            gap:            10,
            padding:        '10px 14px',
            borderRadius:   'var(--radius-lg)',
            background:     t.type === 'error' ? '#ef444422' : '#22c55e18',
            border:         `1px solid ${t.type === 'error' ? '#ef444444' : '#22c55e44'}`,
            color:          t.type === 'error' ? '#f87171' : '#4ade80',
            fontSize:       12,
            fontWeight:     500,
            maxWidth:       320,
            backdropFilter: 'blur(8px)',
            animation:      'fadeIn 0.2s ease',
            boxShadow:      '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ flexShrink: 0 }}>{t.type === 'error' ? '⚠️' : '✓'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.message}
          </span>
          <button
            onClick={() => dismissToast(t.id)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px', opacity: 0.6, fontSize: 14 }}
          >×</button>
        </div>
      ))}
    </div>
  )
}

// ─── Monitor Bar ──────────────────────────────────────────────────────────────
function MonitorBar() {
  const {
    isWatcherActive, watchingFolders,
    startWatcher, stopWatcher, runNow,
    ui: { isLoading },
  } = useAppStore()

  const [runBusy, setRunBusy] = useState(false)

  const handleToggle = async () => {
    if (isWatcherActive) {
      await stopWatcher()
    } else {
      await startWatcher()
    }
  }

  const handleRunNow = async () => {
    setRunBusy(true)
    try { await runNow() } finally { setRunBusy(false) }
  }

  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           10,
      padding:       '8px 16px',
      borderBottom:  '1px solid var(--border-subtle)',
      background:    isWatcherActive ? '#22c55e08' : 'var(--bg-surface)',
      flexShrink:    0,
      transition:    'background 0.3s',
    }}>
      {/* Status dot + label */}
      <span style={{
        width:        7,
        height:       7,
        borderRadius: '50%',
        background:   isWatcherActive ? 'var(--success)' : 'var(--text-muted)',
        boxShadow:    isWatcherActive ? '0 0 6px var(--success)' : 'none',
        flexShrink:   0,
        transition:   'background 0.2s',
      }} />
      <span style={{ fontSize: 12, color: isWatcherActive ? '#4ade80' : 'var(--text-muted)', flex: 1 }}>
        {isWatcherActive
          ? `Memantau ${watchingFolders.length} folder`
          : 'Auto-monitor nonaktif'}
      </span>

      {/* One-click clean button */}
      <button
        type="button"
        onClick={handleRunNow}
        disabled={runBusy || isLoading}
        title="Sortir semua file sekarang"
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          5,
          padding:      '5px 11px',
          borderRadius: 'var(--radius)',
          border:       '1px solid var(--border-default)',
          background:   'transparent',
          color:        runBusy ? 'var(--text-muted)' : 'var(--text-secondary)',
          fontSize:     11,
          fontWeight:   600,
          cursor:       runBusy ? 'not-allowed' : 'pointer',
          fontFamily:   'DM Sans, sans-serif',
          transition:   'background 0.15s',
        }}
        onMouseEnter={e => { if (!runBusy) e.currentTarget.style.background = 'var(--bg-elevated)' }}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {runBusy ? '⏳' : '⚡'} {runBusy ? 'Memproses...' : 'Rapihkan Sekarang'}
      </button>

      {/* Auto-monitor toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-Monitor</span>
        <button
          type="button"
          onClick={handleToggle}
          title={isWatcherActive ? 'Matikan auto-monitor' : 'Aktifkan auto-monitor'}
          style={{
            width:        40,
            height:       22,
            borderRadius: 99,
            border:       '1px solid var(--border-default)',
            background:   isWatcherActive ? 'var(--success)' : 'var(--bg-overlay)',
            position:     'relative',
            cursor:       'pointer',
            transition:   'background 0.2s',
            flexShrink:   0,
          }}
        >
          <span style={{
            position:     'absolute',
            top:          2,
            left:         isWatcherActive ? 19 : 2,
            width:        16,
            height:       16,
            borderRadius: '50%',
            background:   '#fff',
            transition:   'left 0.18s',
            boxShadow:    '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>
    </div>
  )
}

// ─── App root ─────────────────────────────────────────────────────────────────
// ─── AppShell: the actual UI, wrapped by ErrorBoundary below ─────────────────
function AppShell() {
  const {
    ui, setActiveTab, settings, rules,
    bootstrap, updateSettings, openRuleModal,
  } = useAppStore()
  const { activeTab, isLoading } = ui

  // ── Onboarding: show on first run if no rules yet ──────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    bootstrap().then(() => {
      // After bootstrap, check conditions inside a timeout so state has settled
      setTimeout(() => {
        const s = useAppStore.getState()
        if (!s.settings.onboardingComplete) {
          setShowOnboarding(true)
        }
      }, 200)
    })
  }, [])

  const handleOnboardingStart = async () => {
    setShowOnboarding(false)
    await updateSettings({ onboardingComplete: true })
    setActiveTab('rules')
    // Small delay so the Rules tab is visible before the modal opens
    setTimeout(() => openRuleModal(), 300)
  }

  const handleOnboardingSkip = async () => {
    setShowOnboarding(false)
    await updateSettings({ onboardingComplete: true })
  }

  const isMac = navigator.userAgent.includes('Mac')

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100vh',
      background:    'var(--bg-base)',
      overflow:      'hidden',
    }}>

      {/* ── Custom Titlebar ────────────────────────────────────── */}
      <div
        className="drag-region"
        style={{
          height:         40,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          paddingLeft:    isMac ? 80 : 16,
          paddingRight:   isMac ? 16 : 0,
          borderBottom:   '1px solid var(--border-subtle)',
          flexShrink:     0,
          background:     'var(--bg-surface)',
        }}
      >
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        8,
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize:   13,
          color:      'var(--text-primary)',
        }}>
          <span style={{ fontSize: 15 }}>⚡</span>
          AutoMover
          {settings.autoMonitor && (
            <span style={{
              background: '#22c55e22', color: '#22c55e',
              fontSize: 9, fontWeight: 700, padding: '2px 7px',
              borderRadius: 99, fontFamily: 'DM Sans, sans-serif',
              letterSpacing: '0.06em',
            }}>LIVE</span>
          )}
        </div>

        {/* Windows window controls */}
        {!isMac && (
          <div className="no-drag" style={{ display: 'flex' }}>
            {[
              { action: 'minimize', Icon: IconMinus, hoverBg: 'var(--bg-overlay)' },
              { action: 'maximize', Icon: IconSquare, hoverBg: 'var(--bg-overlay)' },
              { action: 'close',    Icon: IconX,     hoverBg: '#c42b1c' },
            ].map(({ action, Icon, hoverBg }) => (
              <button
                key={action}
                type="button"
                onClick={() => window.automover?.window[action]?.()}
                onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{
                  width: 46, height: 40, border: 'none', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.1s',
                }}
              >
                <Icon />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <nav style={{
          width:         192,
          flexShrink:    0,
          borderRight:   '1px solid var(--border-subtle)',
          display:       'flex',
          flexDirection: 'column',
          padding:       '10px 8px',
          gap:           2,
          background:    'var(--bg-surface)',
        }}>
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                className="no-drag"
                onClick={() => setActiveTab(id)}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          9,
                  padding:      '8px 11px',
                  borderRadius: 'var(--radius)',
                  border:       'none',
                  background:   active ? 'var(--accent-muted)' : 'transparent',
                  color:        active ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor:       'pointer',
                  fontSize:     13,
                  fontWeight:   active ? 600 : 400,
                  textAlign:    'left',
                  transition:   'background 0.15s, color 0.15s',
                  fontFamily:   'DM Sans, sans-serif',
                  width:        '100%',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon />
                {label}
              </button>
            )
          })}

          <div style={{ flex: 1 }} />

          {/* Monitor status (sidebar footer) */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          7,
            padding:      '7px 11px',
            borderRadius: 'var(--radius)',
            background:   'var(--bg-elevated)',
            fontSize:     11,
            color:        'var(--text-muted)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: settings.autoMonitor ? 'var(--success)' : 'var(--bg-overlay)',
              boxShadow:  settings.autoMonitor ? '0 0 5px var(--success)' : 'none',
              transition: 'background 0.2s',
            }} />
            {settings.autoMonitor ? 'Monitoring aktif' : 'Tidak aktif'}
          </div>
        </nav>

        {/* Content area */}
        <main style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          background:    'var(--bg-base)',
        }}>
          {/* Monitor control bar — shown on all tabs */}
          <MonitorBar />

          {isLoading ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              <span style={{ opacity: 0.6 }}>Memuat data...</span>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {activeTab === 'rules'    && <RulesSection />}
              {activeTab === 'logs'     && <ActivityLog />}
              {activeTab === 'settings' && <TrayMenu />}
            </div>
          )}
        </main>
      </div>

      {/* Toast notifications (fixed overlay) */}
      <ToastList />

      {/* Onboarding modal — shown on first run */}
      {showOnboarding && (
        <OnboardingModal
          onStart={handleOnboardingStart}
          onSkip={handleOnboardingSkip}
        />
      )}
    </div>
  )
}

// ─── Default export: AppShell wrapped in ErrorBoundary ────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}