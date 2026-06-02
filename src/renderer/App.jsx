import { useEffect, useMemo, useState, Component } from 'react'
import useAppStore from './store/useAppStore'
import RuleList from './components/RuleList'
import RuleBuilder from './components/RuleBuilder'
import ActivityLog from './components/ActivityLog'
import TrayMenu from './components/TrayMenu'
import PreviewPage from './components/PreviewPage'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AutoMover ErrorBoundary] Unhandled error:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-primary)', padding: 40 }}>
        <div style={{ width: 520, padding: 28, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>⚠️</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, margin: 0 }}>Terjadi Kesalahan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>AutoMover mengalami error internal. Data dan file Anda tidak terpengaruh.</p>
          {this.state.error && <code style={{ display: 'block', padding: 12, background: 'var(--bg-overlay)', color: 'var(--danger)', borderRadius: 8, fontSize: 11, textAlign: 'left', wordBreak: 'break-word' }}>{this.state.error.message}</code>}
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 18, padding: '9px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Coba Lagi</button>
        </div>
      </div>
    )
  }
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'rules', label: 'Rules', icon: '⚙' },
  { id: 'preview', label: 'Preview', icon: '◌' },
  { id: 'presets', label: 'Presets', icon: '▣' },
  { id: 'logs', label: 'History', icon: '≡' },
  { id: 'reports', label: 'Reports', icon: '↧' },
  { id: 'settings', label: 'Settings', icon: '☰' },
]

const Icon = ({ children }) => <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>{children}</span>
const IconMinus = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="5.5" width="10" height="1.2" rx="0.6" /></svg>
const IconSquare = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1.5" y="1.5" width="9" height="9" rx="1" /></svg>
const IconX = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5" /></svg>

function Pill({ children, tone = 'neutral' }) {
  const map = {
    neutral: ['var(--bg-overlay)', 'var(--text-secondary)', 'var(--border-default)'],
    live: ['#22c55e18', '#4ade80', '#22c55e44'],
    accent: ['var(--accent-muted)', 'var(--accent)', 'var(--accent-border)'],
    danger: ['#ef444418', '#f87171', '#ef444444'],
  }
  const [bg, color, border] = map[tone] || map.neutral
  return <span style={{ padding: '4px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}`, fontSize: 11, fontWeight: 700 }}>{children}</span>
}

function PrimaryButton({ children, onClick, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ padding: '9px 14px', border: 'none', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : 'var(--accent)', color: disabled ? 'var(--text-muted)' : '#fff', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{children}</button>
}

function SecondaryButton({ children, onClick, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ padding: '9px 14px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: 'var(--bg-surface)', color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{children}</button>
}

function StatCard({ label, value, hint, tone = 'neutral' }) {
  return (
    <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
        <Pill tone={tone}>{hint}</Pill>
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 30, fontWeight: 700, marginTop: 12 }}>{value}</div>
    </div>
  )
}

function PageHeader({ eyebrow, title, desc, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, padding: '22px 26px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, lineHeight: 1.1, margin: 0 }}>{title}</h1>
        {desc && <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, maxWidth: 680 }}>{desc}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}

function Inspector({ title, subtitle, items = [], action }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 16 }}>
      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700 }}>{title}</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(([k, v]) => (
          <div key={k} style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</div>
            <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      {action}
    </div>
  )
}

function DashboardPage({ onCreateRule, onOpenRules, onOpenPreview }) {
  const { rules, logs, isWatcherActive, watchingFolders, runNow, ui } = useAppStore()
  const [runBusy, setRunBusy] = useState(false)
  const activeRules = rules.filter(r => r.isActive).length
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayLogs = logs.filter(l => String(l.timestamp || '').slice(0, 10) === todayKey)
  const recentLogs = logs.slice(0, 7)

  const handleRun = async () => {
    setRunBusy(true)
    try { await runNow() } finally { setRunBusy(false) }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        eyebrow="Workspace"
        title="AutoMover Dashboard"
        desc="Pusat kontrol untuk memantau folder, menjalankan sortir manual, dan melihat aktivitas terbaru."
        actions={<><SecondaryButton onClick={onOpenPreview}>Preview</SecondaryButton><SecondaryButton onClick={onOpenRules}>Lihat Rules</SecondaryButton><PrimaryButton onClick={onCreateRule}>+ Buat Rule</PrimaryButton></>}
      />
      <div style={{ padding: 24, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          <StatCard label="Files today" value={todayLogs.length} hint="hari ini" tone="accent" />
          <StatCard label="Active rules" value={activeRules} hint={`${rules.length} total`} />
          <StatCard label="Monitored" value={watchingFolders.length} hint={isWatcherActive ? 'live' : 'off'} tone={isWatcherActive ? 'live' : 'neutral'} />
          <StatCard label="History" value={logs.length} hint="max 500" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr .65fr', gap: 16, alignItems: 'stretch' }}>
          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15 }}>Recent Activity</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>Aktivitas file terbaru akan muncul di sini.</p>
              </div>
              <Pill tone={isWatcherActive ? 'live' : 'neutral'}>{isWatcherActive ? 'Monitoring ON' : 'Monitoring OFF'}</Pill>
            </div>
            <div style={{ padding: 12 }}>
              {recentLogs.length === 0 ? (
                <div style={{ padding: 34, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Belum ada aktivitas. Buat rule lalu jalankan preview atau rapihkan sekarang.</div>
              ) : recentLogs.map(log => (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.fileName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.to}</div>
                  </div>
                  <Pill tone={log.undone ? 'danger' : 'accent'}>{log.action}</Pill>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15 }}>Quick Actions</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>Aksi cepat tanpa masuk ke halaman pengaturan mendalam.</p>
            </div>
            <PrimaryButton onClick={handleRun} disabled={runBusy || ui.isLoading}>{runBusy ? 'Memproses...' : '⚡ Rapihkan Sekarang'}</PrimaryButton>
            <SecondaryButton onClick={onOpenPreview}>Run Preview</SecondaryButton>
            <SecondaryButton onClick={onCreateRule}>+ Rule Baru</SecondaryButton>
            <SecondaryButton onClick={onOpenRules}>Kelola Rules</SecondaryButton>
          </section>
        </div>
      </div>
    </div>
  )
}

function RulesWorkspace() {
  const { addRule, updateRule } = useAppStore()
  const [editingRule, setEditingRule] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const openCreate = () => { setEditingRule(undefined); setPanelOpen(true) }
  const openEdit = (rule) => { setEditingRule(rule); setPanelOpen(true) }
  const closePanel = () => { setPanelOpen(false); setTimeout(() => setEditingRule(null), 160) }

  const handleSave = async (rule) => {
    if (editingRule && editingRule.id) await updateRule(rule)
    else await addRule(rule)
    closePanel()
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: panelOpen ? 'minmax(420px, 1fr) minmax(420px, 520px)' : '1fr 320px', overflow: 'hidden', transition: 'grid-template-columns .25s ease' }}>
      <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PageHeader eyebrow="Rules" title="File Organization Rules" desc="Buat dan kelola aturan untuk Smart Category, ekstensi, nama file, reference list, dan folder tetap." actions={<PrimaryButton onClick={openCreate}>+ Buat Rule</PrimaryButton>} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}><RuleList onAddNew={openCreate} onEdit={openEdit} /></div>
      </section>
      <aside style={{ minWidth: 0, borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
        {panelOpen ? <RuleBuilder rule={editingRule ?? null} onSave={handleSave} onCancel={closePanel} /> : <Inspector title="Rule Inspector" subtitle="Pilih rule untuk melihat detail atau buat rule baru." items={[[ 'Match', 'Exact, Partial, Smart, Nama, Ekstensi' ], [ 'Destination', 'Folder tetap, kategori, ekstensi, nama file' ], [ 'Next', 'Preview, Preset, Export CSV' ]]} action={<PrimaryButton onClick={openCreate}>+ Rule Baru</PrimaryButton>} />}
      </aside>
    </div>
  )
}

function PlaceholderPage({ page }) {
  const content = {
    presets: ['Presets', 'Simpan workflow favorit seperti Rapikan Downloads, Foto SANOB, Invoice Kantor, atau File Kuliah.'],
    reports: ['Reports', 'Export CSV dari hasil preview/run dengan status, operation, source, destination, matched keyword, reason, dan confidence.'],
  }[page]
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <PageHeader eyebrow="Coming next" title={content[0]} desc={content[1]} />
        <div style={{ padding: 24, overflow: 'auto' }}><div style={{ padding: 28, border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-xl)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>Halaman ini disiapkan untuk pengembangan lanjutan.</div></div>
      </section>
      <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}><Inspector title="Roadmap Slot" subtitle="Area ini akan dipakai untuk detail hasil, filter, dan ringkasan." items={[[content[0], 'Disiapkan untuk tahap pengembangan berikutnya.'], ['UI Strategy', 'Progressive disclosure.']]} /></aside>
    </div>
  )
}

function SettingsPage() {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <PageHeader eyebrow="Settings" title="Application Settings" desc="Pengaturan tray, auto-monitor, notifikasi, dan perilaku aplikasi." />
        <div style={{ flex: 1, overflow: 'auto' }}><TrayMenu /></div>
      </section>
      <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}><Inspector title="Settings Inspector" subtitle="Nanti area ini bisa menampilkan default match mode, default conflict strategy, theme, dan startup behavior." items={[[ 'Current', 'Tray dan setting dasar tetap memakai komponen lama.' ], [ 'Next', 'Default workflow settings.' ]]} /></aside>
    </div>
  )
}

function HistoryPage() {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
      <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <PageHeader eyebrow="History" title="Activity History" desc="Riwayat move/copy/undo dari semua rule AutoMover." />
        <div style={{ flex: 1, overflow: 'hidden' }}><ActivityLog /></div>
      </section>
      <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}><Inspector title="History Inspector" subtitle="Area detail untuk file yang dipilih akan ditambahkan di tahap berikutnya." items={[[ 'Undo', 'Sudah tersedia dari ActivityLog.' ], [ 'Next', 'Filter by date, rule, status, dan export.' ]]} /></aside>
    </div>
  )
}

function ToastList() {
  const { toasts, dismissToast } = useAppStore()
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-lg)', background: t.type === 'error' ? '#ef444422' : '#22c55e18', border: `1px solid ${t.type === 'error' ? '#ef444444' : '#22c55e44'}`, color: t.type === 'error' ? '#f87171' : '#4ade80', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.35)' }}>
          <span>{t.type === 'error' ? '⚠️' : '✓'}</span><span style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.message}</span><button onClick={() => dismissToast(t.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: .7 }}>×</button>
        </div>
      ))}
    </div>
  )
}

function TopBar({ title }) {
  const { isWatcherActive, watchingFolders, startWatcher, stopWatcher, runNow, ui } = useAppStore()
  const [busy, setBusy] = useState(false)
  const handleRun = async () => { setBusy(true); try { await runNow() } finally { setBusy(false) } }
  const handleToggle = async () => { isWatcherActive ? await stopWatcher() : await startWatcher() }
  const isMac = navigator.userAgent.includes('Mac')
  return (
    <div className="app-drag-region" style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: isMac ? 80 : 18, paddingRight: isMac ? 18 : 0, borderBottom: '1px solid var(--border-subtle)', background: 'rgba(22,22,29,.92)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 900, fontFamily: 'Syne, sans-serif' }}>A</div><div><div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800 }}>AutoMover</div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{title}</div></div><Pill tone={isWatcherActive ? 'live' : 'neutral'}>{isWatcherActive ? `LIVE · ${watchingFolders.length} folder` : 'Monitor off'}</Pill></div>
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SecondaryButton onClick={handleRun} disabled={busy || ui.isLoading}>{busy ? 'Memproses...' : '⚡ Rapihkan Sekarang'}</SecondaryButton>
        <button type="button" onClick={handleToggle} style={{ width: 46, height: 26, borderRadius: 99, border: '1px solid var(--border-default)', background: isWatcherActive ? 'var(--success)' : 'var(--bg-overlay)', position: 'relative', cursor: 'pointer' }}><span style={{ position: 'absolute', top: 3, left: isWatcherActive ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s', boxShadow: '0 1px 4px rgba(0,0,0,.35)' }} /></button>
        {!isMac && <div style={{ display: 'flex', marginLeft: 6 }}>{[['minimize', IconMinus, 'var(--bg-overlay)'], ['maximize', IconSquare, 'var(--bg-overlay)'], ['close', IconX, '#c42b1c']].map(([action, ControlIcon, hoverBg]) => <button key={action} type="button" onClick={() => window.automover?.window[action]?.()} onMouseEnter={e => { e.currentTarget.style.background = hoverBg }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }} style={{ width: 46, height: 58, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ControlIcon /></button>)}</div>}
      </div>
    </div>
  )
}

function Sidebar({ activeTab, setActiveTab }) {
  const { isWatcherActive, watchingFolders, rules } = useAppStore()
  return (
    <nav style={{ width: 228, flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 14, gap: 4 }}>
      <div style={{ padding: '8px 8px 18px' }}><div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Workspace</div></div>
      {NAV_ITEMS.map(item => {
        const active = activeTab === item.id
        return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px', borderRadius: 'var(--radius)', border: 'none', background: active ? 'var(--accent-muted)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: active ? 800 : 600, textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}><Icon>{item.icon}</Icon>{item.label}</button>
      })}
      <div style={{ flex: 1 }} />
      <div style={{ padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: isWatcherActive ? 'var(--success)' : 'var(--text-muted)', boxShadow: isWatcherActive ? '0 0 7px var(--success)' : 'none' }} /><span style={{ fontSize: 12, fontWeight: 800 }}>{isWatcherActive ? 'Monitoring aktif' : 'Monitoring off'}</span></div><div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.55 }}>{watchingFolders.length} folder dipantau · {rules.filter(r => r.isActive).length} rule aktif</div></div>
    </nav>
  )
}

function AppShell() {
  const { ui, setActiveTab, settings, bootstrap, updateSettings, openRuleModal } = useAppStore()
  const { activeTab, isLoading } = ui
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    bootstrap().then(() => {
      setTimeout(() => {
        const s = useAppStore.getState()
        if (!s.settings.onboardingComplete) setShowOnboarding(true)
      }, 200)
    })
  }, [])

  const currentTitle = useMemo(() => NAV_ITEMS.find(i => i.id === activeTab)?.label || 'Dashboard', [activeTab])

  const handleOnboardingStart = async () => {
    setShowOnboarding(false)
    await updateSettings({ onboardingComplete: true })
    setActiveTab('rules')
    setTimeout(() => openRuleModal(), 250)
  }

  const handleOnboardingSkip = async () => {
    setShowOnboarding(false)
    await updateSettings({ onboardingComplete: true })
  }

  const openCreateRuleFromDashboard = () => {
    setActiveTab('rules')
    setTimeout(() => openRuleModal(), 120)
  }

  const renderPage = () => {
    if (isLoading) return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Memuat data...</div>
    if (activeTab === 'dashboard') return <DashboardPage onCreateRule={openCreateRuleFromDashboard} onOpenRules={() => setActiveTab('rules')} onOpenPreview={() => setActiveTab('preview')} />
    if (activeTab === 'rules') return <RulesWorkspace />
    if (activeTab === 'preview') return <PreviewPage />
    if (activeTab === 'logs') return <HistoryPage />
    if (activeTab === 'settings') return <SettingsPage />
    if (activeTab === 'presets') return <PlaceholderPage page="presets" />
    if (activeTab === 'reports') return <PlaceholderPage page="reports" />
    return <DashboardPage onCreateRule={openCreateRuleFromDashboard} onOpenRules={() => setActiveTab('rules')} onOpenPreview={() => setActiveTab('preview')} />
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden', color: 'var(--text-primary)' }}>
      <TopBar title={currentTitle} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(124,58,237,.04), transparent 220px), var(--bg-base)' }}>{renderPage()}</main>
      </div>
      <ToastList />
      {showOnboarding && <OnboardingModal onStart={handleOnboardingStart} onSkip={handleOnboardingSkip} />}
    </div>
  )
}

function OnboardingModal({ onStart, onSkip }) {
  const [step, setStep] = useState(0)
  const steps = [
    { icon: '📂', title: 'Pilih folder sumber', desc: 'Gunakan folder seperti Downloads, Desktop, atau folder kerja yang sering berantakan.' },
    { icon: '🧠', title: 'Tentukan cara sortir', desc: 'Pilih Smart Category, ekstensi, nama file, atau folder tetap sesuai kebutuhan.' },
    { icon: '⚡', title: 'Jalankan otomatis', desc: 'Aktifkan Auto-Monitor atau gunakan Rapihkan Sekarang untuk proses manual.' },
  ]
  const item = steps[step]
  const isLast = step === steps.length - 1
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 430, padding: 30, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 52, lineHeight: 1, marginBottom: 16 }}>{item.icon}</div><h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, margin: 0 }}>{item.title}</h2><p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>{item.desc}</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}><button type="button" onClick={isLast ? onStart : () => setStep(s => s + 1)} style={{ padding: '11px 0', border: 'none', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{isLast ? 'Mulai Buat Aturan' : 'Selanjutnya →'}</button><button type="button" onClick={onSkip} style={{ padding: '8px 0', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Lewati</button></div>
      </div>
    </div>
  )
}

export default function App() {
  return <ErrorBoundary><AppShell /></ErrorBoundary>
}
