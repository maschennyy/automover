import { useState } from 'react'
import useAppStore from '../store/useAppStore'

function Pill({ children, tone = 'neutral' }) {
  const map = {
    neutral: ['var(--bg-overlay)', 'var(--text-secondary)', 'var(--border-default)'],
    planned: ['#22c55e18', '#4ade80', '#22c55e44'],
    warning: ['#f59e0b18', '#fbbf24', '#f59e0b44'],
    danger: ['#ef444418', '#f87171', '#ef444444'],
    accent: ['var(--accent-muted)', 'var(--accent)', 'var(--accent-border)'],
  }
  const [bg, color, border] = map[tone] || map.neutral
  return <span style={{ padding: '4px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}`, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{children}</span>
}

function StatCard({ label, value, hint, tone }) {
  return (
    <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        {hint && <Pill tone={tone}>{hint}</Pill>}
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 30, fontWeight: 800, marginTop: 12 }}>{value}</div>
    </div>
  )
}

function ActionButton({ children, onClick, disabled, primary = false, danger = false }) {
  const bg = danger ? '#ef4444' : primary ? 'var(--accent)' : 'var(--bg-surface)'
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding: '9px 14px', border: primary || danger ? 'none' : '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : bg, color: disabled ? 'var(--text-muted)' : primary || danger ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{children}</button>
  )
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function exportPreviewCsv(result) {
  const rows = result?.items || []
  const headers = ['generatedAt', 'status', 'fileName', 'sourcePath', 'destinationPath', 'destinationFolder', 'ruleId', 'ruleName', 'action', 'conflictStrategy', 'willCreateFolder', 'conflict', 'renamed', 'skipped', 'overwritten', 'message']
  const csv = [headers.join(','), ...rows.map(item => headers.map(header => csvEscape(header === 'generatedAt' ? result.generatedAt : item[header])).join(','))].join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const link = document.createElement('a')
  link.href = url
  link.download = `automover-preview-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function EmptyState({ onRun, busy }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 32 }}>
      <div style={{ maxWidth: 520, textAlign: 'center', padding: 28, background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>◌</div>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, margin: 0 }}>Preview belum dijalankan</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>Jalankan dry run untuk melihat file mana saja yang akan dipindahkan, folder apa yang akan dibuat, dan apakah ada konflik nama. Preview tidak akan memindahkan file.</p>
        <ActionButton onClick={onRun} disabled={busy} primary>{busy ? 'Memindai...' : 'Run Preview'}</ActionButton>
      </div>
    </div>
  )
}

function PreviewTable({ items }) {
  if (!items.length) return <div style={{ padding: 34, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada file yang cocok dengan rule aktif saat ini.</div>

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-surface)' }}>
          <tr>{['Status', 'File', 'Rule', 'Action', 'Destination', 'Note'].map(head => <th key={head} style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', padding: '11px 12px', borderBottom: '1px solid var(--border-subtle)' }}>{head}</th>)}</tr>
        </thead>
        <tbody>
          {items.map(item => {
            const statusTone = item.status === 'error' ? 'danger' : item.renamed || item.willCreateFolder || item.skipped || item.overwritten ? 'warning' : 'planned'
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 12px', verticalAlign: 'top' }}><Pill tone={statusTone}>{item.status}</Pill></td>
                <td style={{ padding: '10px 12px', verticalAlign: 'top', minWidth: 160 }}><div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.fileName}</div><div title={item.sourcePath} style={{ color: 'var(--text-muted)', marginTop: 3, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sourcePath}</div></td>
                <td style={{ padding: '10px 12px', verticalAlign: 'top', color: 'var(--text-secondary)', minWidth: 120 }}>{item.ruleName}</td>
                <td style={{ padding: '10px 12px', verticalAlign: 'top' }}><Pill tone="accent">{item.action}</Pill></td>
                <td style={{ padding: '10px 12px', verticalAlign: 'top', minWidth: 260 }}><div title={item.destinationPath} style={{ color: item.status === 'error' ? 'var(--danger)' : 'var(--text-primary)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.destinationPath || '-'}</div>{item.destinationFolder && <div title={item.destinationFolder} style={{ color: 'var(--text-muted)', marginTop: 3, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.destinationFolder}</div>}</td>
                <td style={{ padding: '10px 12px', verticalAlign: 'top', color: item.status === 'error' ? 'var(--danger)' : 'var(--text-secondary)', minWidth: 220 }}>{item.message}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PreviewInspector({ result }) {
  const summary = result?.summary || { planned: 0, skipped: 0, error: 0, createFolders: 0, conflicts: 0, renamed: 0, overwritten: 0, folders: 0 }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 14 }}>
      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800 }}>Dry Run Summary</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>Preview membaca rule aktif dan folder sumber. Jalankan execute hanya setelah hasil preview sudah sesuai.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}><div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Folders scanned</div><div style={{ marginTop: 5, fontSize: 20, fontWeight: 800 }}>{summary.folders}</div></div>
        <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}><div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Generated at</div><div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-secondary)' }}>{result?.generatedAt ? new Date(result.generatedAt).toLocaleString() : '-'}</div></div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Status Meaning</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <div><Pill tone="planned">planned</Pill> file siap diproses saat Execute.</div>
          <div><Pill tone="warning">warning</Pill> folder akan dibuat, nama akan berubah, skip, atau overwrite.</div>
          <div><Pill tone="danger">error</Pill> rule perlu diperbaiki sebelum aman dijalankan.</div>
        </div>
      </div>
      {result?.errors?.length > 0 && <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--danger)' }}>Errors</div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{result.errors.slice(0, 6).map((err, idx) => <div key={idx} style={{ padding: 10, background: '#ef444418', border: '1px solid #ef444444', borderRadius: 'var(--radius)', color: '#f87171', fontSize: 11, lineHeight: 1.5 }}>{err.fileName ? `${err.fileName}: ` : ''}{err.error}</div>)}</div></div>}
    </div>
  )
}

export default function PreviewPage() {
  const { runNow, fetchLogs } = useAppStore()
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const runPreview = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const preview = await window.automover.preview.run()
      setResult(preview)
      if (!preview?.success && preview?.errors?.length) setError(preview.errors[0].error || 'Preview gagal dijalankan')
      return preview
    } catch (err) {
      setError(err.message)
      setResult(null)
      return null
    } finally {
      setBusy(false)
    }
  }

  const executePreview = async () => {
    const planned = result?.summary?.planned || 0
    const skipped = result?.summary?.skipped || 0
    const errorCount = result?.summary?.error || 0
    if (!planned && !skipped) return
    if (errorCount > 0) {
      setError('Preview masih memiliki error. Perbaiki rule terlebih dahulu sebelum execute.')
      return
    }
    const ok = window.confirm(`Execute ${planned} planned action${planned === 1 ? '' : 's'}${skipped ? ` dan ${skipped} skip` : ''}? File akan benar-benar diproses.`)
    if (!ok) return

    setExecuting(true)
    setError('')
    setNotice('')
    try {
      const runResult = await runNow()
      await fetchLogs()
      const successCount = runResult?.success?.length || 0
      const skippedCount = runResult?.skipped?.length || 0
      const errorCountRun = runResult?.errors?.length || 0
      setNotice(`Execute selesai: ${successCount} berhasil${skippedCount ? `, ${skippedCount} skipped` : ''}${errorCountRun ? `, ${errorCountRun} error` : ''}. Preview sudah direfresh.`)
      await runPreview()
    } catch (err) {
      setError(err.message)
    } finally {
      setExecuting(false)
    }
  }

  const summary = result?.summary || { planned: 0, skipped: 0, error: 0, createFolders: 0, conflicts: 0, renamed: 0, overwritten: 0, folders: 0 }
  const items = result?.items || []
  const canExport = Boolean(result && items.length > 0)
  const canExecute = Boolean(result && (summary.planned > 0 || summary.skipped > 0) && summary.error === 0)

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, padding: '22px 26px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Preview</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, lineHeight: 1.1, margin: 0 }}>Dry Run Preview</h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}>Simulasikan semua rule aktif, lalu execute langsung dari hasil preview jika sudah sesuai.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <ActionButton onClick={() => exportPreviewCsv(result)} disabled={!canExport}>Export CSV</ActionButton>
            <ActionButton onClick={executePreview} disabled={!canExecute || executing || busy} danger>{executing ? 'Executing...' : 'Execute Planned'}</ActionButton>
            <ActionButton onClick={runPreview} disabled={busy || executing} primary>{busy ? 'Memindai...' : 'Run Preview'}</ActionButton>
          </div>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, borderBottom: '1px solid var(--border-subtle)' }}>
          <StatCard label="Planned" value={summary.planned} hint="ready" tone="planned" />
          <StatCard label="Skipped" value={summary.skipped || 0} hint="skip" tone={summary.skipped ? 'warning' : 'neutral'} />
          <StatCard label="Errors" value={summary.error} hint="check" tone={summary.error ? 'danger' : 'neutral'} />
          <StatCard label="Folders" value={summary.createFolders} hint="will create" tone="warning" />
          <StatCard label="Conflicts" value={summary.conflicts} hint="detected" tone={summary.conflicts ? 'warning' : 'neutral'} />
          <StatCard label="Renamed" value={summary.renamed} hint="suffix" tone={summary.renamed ? 'warning' : 'neutral'} />
        </div>

        {error && <div style={{ margin: 20, padding: 12, background: '#ef444418', border: '1px solid #ef444444', color: '#f87171', borderRadius: 'var(--radius)', fontSize: 12 }}>{error}</div>}
        {notice && <div style={{ margin: error ? '0 20px 20px' : 20, padding: 12, background: '#22c55e18', border: '1px solid #22c55e44', color: '#4ade80', borderRadius: 'var(--radius)', fontSize: 12 }}>{notice}</div>}

        <div style={{ flex: 1, minHeight: 0, margin: result ? '0 20px 20px' : 0, background: result ? 'var(--bg-surface)' : 'transparent', border: result ? '1px solid var(--border-subtle)' : 'none', borderRadius: result ? 'var(--radius-xl)' : 0, overflow: 'hidden' }}>
          {!result ? <EmptyState onRun={runPreview} busy={busy} /> : <PreviewTable items={items} />}
        </div>
      </section>
      <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden' }}><PreviewInspector result={result} /></aside>
    </div>
  )
}
