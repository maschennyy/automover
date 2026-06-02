import { useMemo, useState } from 'react'
import useAppStore from '../store/useAppStore'

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function exportLogsCsv(logs) {
  const headers = ['timestamp', 'action', 'fileName', 'from', 'to', 'ruleId', 'conflict', 'renamed', 'skipped', 'overwritten', 'undone']
  const csv = [headers.join(','), ...logs.map(log => headers.map(header => csvEscape(log[header])).join(','))].join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const link = document.createElement('a')
  link.href = url
  link.download = `automover-activity-report-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function Pill({ children, tone = 'neutral' }) {
  const palette = {
    neutral: ['var(--bg-overlay)', 'var(--text-secondary)', 'var(--border-default)'],
    accent: ['var(--accent-muted)', 'var(--accent)', 'var(--accent-border)'],
    green: ['#22c55e18', '#4ade80', '#22c55e44'],
    amber: ['#f59e0b18', '#fbbf24', '#f59e0b44'],
    red: ['#ef444418', '#f87171', '#ef444444'],
  }[tone]
  return <span style={{ padding: '4px 8px', borderRadius: 99, background: palette[0], color: palette[1], border: `1px solid ${palette[2]}`, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{children}</span>
}

function StatCard({ label, value, hint, tone = 'neutral' }) {
  return (
    <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        {hint && <Pill tone={tone}>{hint}</Pill>}
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 30, fontWeight: 800, marginTop: 12 }}>{value}</div>
    </div>
  )
}

function ActionButton({ children, onClick, disabled, primary = false }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ padding: '9px 14px', border: primary ? 'none' : '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : primary ? 'var(--accent)' : 'var(--bg-surface)', color: disabled ? 'var(--text-muted)' : primary ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </button>
  )
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? '1px solid var(--accent-border)' : '1px solid var(--border-default)',
        background: active ? 'var(--accent-muted)' : 'var(--bg-overlay)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function actionTone(action, undone) {
  if (undone) return 'red'
  if (action === 'skip') return 'amber'
  if (action === 'copy') return 'green'
  return 'accent'
}

function matchesSearch(log, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [log.fileName, log.from, log.to, log.ruleId, log.action]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(q))
}

function matchesAction(log, actionFilter) {
  if (actionFilter === 'all') return true
  if (actionFilter === 'undone') return Boolean(log.undone)
  if (actionFilter === 'skip') return log.action === 'skip' || Boolean(log.skipped)
  return log.action === actionFilter
}

function matchesFlag(log, flagFilter) {
  if (flagFilter === 'all') return true
  if (flagFilter === 'conflict') return Boolean(log.conflict)
  if (flagFilter === 'renamed') return Boolean(log.renamed)
  if (flagFilter === 'overwritten') return Boolean(log.overwritten)
  if (flagFilter === 'normal') return !log.conflict && !log.renamed && !log.skipped && !log.overwritten && !log.undone
  return true
}

function ReportsFilters({ search, setSearch, actionFilter, setActionFilter, flagFilter, setFlagFilter, onClear, hasFilter }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search file, source, destination, ruleId..."
          style={{ flex: 1, minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
        />
        <ActionButton onClick={onClear} disabled={!hasFilter}>Clear</ActionButton>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Action</span>
        {[
          ['all', 'All'],
          ['move', 'Move'],
          ['copy', 'Copy'],
          ['skip', 'Skip'],
          ['undone', 'Undone'],
        ].map(([value, label]) => <FilterButton key={value} active={actionFilter === value} onClick={() => setActionFilter(value)}>{label}</FilterButton>)}
        <span style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Flag</span>
        {[
          ['all', 'All'],
          ['normal', 'Normal'],
          ['conflict', 'Conflict'],
          ['renamed', 'Renamed'],
          ['overwritten', 'Overwrite'],
        ].map(([value, label]) => <FilterButton key={value} active={flagFilter === value} onClick={() => setFlagFilter(value)}>{label}</FilterButton>)}
      </div>
    </div>
  )
}

function ReportsTable({ logs }) {
  if (!logs.length) {
    return <div style={{ padding: 34, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada log yang cocok dengan filter saat ini.</div>
  }

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'auto', scrollbarGutter: 'stable both-edges' }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-surface)', boxShadow: '0 1px 0 var(--border-subtle)' }}>
          <tr>
            {['Time', 'Action', 'File', 'Source', 'Destination', 'Flags'].map(head => (
              <th key={head} style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', padding: '11px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', verticalAlign: 'top', minWidth: 170 }}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
              <td style={{ padding: '10px 12px', verticalAlign: 'top', minWidth: 90 }}><Pill tone={actionTone(log.action, log.undone)}>{log.undone ? 'undone' : log.action}</Pill></td>
              <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary)', minWidth: 190, verticalAlign: 'top' }}>{log.fileName}</td>
              <td style={{ padding: '10px 12px', color: 'var(--text-muted)', minWidth: 340, verticalAlign: 'top' }}><div title={log.from} style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.from}</div></td>
              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', minWidth: 360, verticalAlign: 'top' }}><div title={log.to} style={{ maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.to}</div></td>
              <td style={{ padding: '10px 12px', verticalAlign: 'top', minWidth: 220 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {log.conflict && <Pill tone="amber">conflict</Pill>}
                  {log.renamed && <Pill tone="amber">renamed</Pill>}
                  {log.skipped && <Pill tone="amber">skipped</Pill>}
                  {log.overwritten && <Pill tone="red">overwritten</Pill>}
                  {log.undone && <Pill tone="red">undone</Pill>}
                  {!log.conflict && !log.renamed && !log.skipped && !log.overwritten && !log.undone && <Pill>normal</Pill>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportsInspector({ logs, filteredLogs }) {
  const last = filteredLogs[0] || logs[0]
  const conflictCount = filteredLogs.filter(l => l.conflict).length
  const undoneCount = filteredLogs.filter(l => l.undone).length
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 14 }}>
      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800 }}>Report Summary</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>Reports memakai data Activity Log yang tersimpan di aplikasi. Export CSV mengikuti hasil filter aktif.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Last visible activity</div>
          <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{last ? `${last.fileName} · ${new Date(last.timestamp).toLocaleString()}` : '-'}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Filtered Attention</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}><Pill tone={conflictCount ? 'amber' : 'neutral'}>{conflictCount} conflict</Pill><Pill tone={undoneCount ? 'red' : 'neutral'}>{undoneCount} undone</Pill></div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>CSV Contents</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>timestamp, action, fileName, source, destination, ruleId, conflict flags, dan undo status.</div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { logs } = useAppStore()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [flagFilter, setFlagFilter] = useState('all')

  const filteredLogs = useMemo(() => {
    return logs.filter(log => matchesSearch(log, search) && matchesAction(log, actionFilter) && matchesFlag(log, flagFilter))
  }, [logs, search, actionFilter, flagFilter])

  const moved = filteredLogs.filter(l => l.action === 'move').length
  const copied = filteredLogs.filter(l => l.action === 'copy').length
  const skipped = filteredLogs.filter(l => l.action === 'skip' || l.skipped).length
  const overwritten = filteredLogs.filter(l => l.overwritten).length
  const undone = filteredLogs.filter(l => l.undone).length
  const hasFilter = Boolean(search.trim() || actionFilter !== 'all' || flagFilter !== 'all')
  const canExport = filteredLogs.length > 0

  const clearFilters = () => {
    setSearch('')
    setActionFilter('all')
    setFlagFilter('all')
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', overflow: 'hidden' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, padding: '22px 26px 18px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Reports</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, lineHeight: 1.1, margin: 0 }}>Activity Reports</h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}>Lihat ringkasan aktivitas AutoMover, cari log tertentu, dan export hasil filter ke CSV.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}><ActionButton onClick={() => exportLogsCsv(filteredLogs)} disabled={!canExport} primary>Export Filtered CSV</ActionButton></div>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <StatCard label="Visible" value={filteredLogs.length} hint={`${logs.length} total`} tone="accent" />
          <StatCard label="Moved" value={moved} hint="move" tone="accent" />
          <StatCard label="Copied" value={copied} hint="copy" tone="green" />
          <StatCard label="Skipped" value={skipped} hint="skip" tone={skipped ? 'amber' : 'neutral'} />
          <StatCard label="Undone" value={undone} hint="undo" tone={undone ? 'red' : 'neutral'} />
        </div>

        <ReportsFilters
          search={search}
          setSearch={setSearch}
          actionFilter={actionFilter}
          setActionFilter={setActionFilter}
          flagFilter={flagFilter}
          setFlagFilter={setFlagFilter}
          onClear={clearFilters}
          hasFilter={hasFilter}
        />

        {overwritten > 0 && <div style={{ margin: '16px 20px 0', padding: 12, background: '#ef444418', border: '1px solid #ef444444', color: '#f87171', borderRadius: 'var(--radius)', fontSize: 12, flexShrink: 0 }}>Ada {overwritten} aktivitas overwrite dalam hasil filter. Pastikan laporan ini disimpan jika dibutuhkan untuk audit.</div>}

        <div style={{ flex: 1, minHeight: 0, margin: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ReportsTable logs={filteredLogs} />
          <div style={{ flexShrink: 0, padding: '9px 14px', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>Showing {filteredLogs.length} of {logs.length} logs{hasFilter ? ' · filtered' : ''}</span>
            <span>Scroll vertikal untuk melihat semua log · scroll horizontal untuk path panjang</span>
          </div>
        </div>
      </section>

      <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden', minHeight: 0 }}><ReportsInspector logs={logs} filteredLogs={filteredLogs} /></aside>
    </div>
  )
}
