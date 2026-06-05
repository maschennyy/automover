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

function StatCard({ label, value, hint, tone, compact }) {
  return <div style={{ padding: compact ? 12 : 15, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>{hint && <Pill tone={tone}>{hint}</Pill>}</div><div style={{ fontFamily: 'Syne, sans-serif', fontSize: compact ? 24 : 30, fontWeight: 800, marginTop: 10 }}>{value}</div></div>
}

function ActionButton({ children, onClick, disabled, primary = false, danger = false, compact = false }) {
  const bg = danger ? '#ef4444' : primary ? 'var(--accent)' : 'var(--bg-surface)'
  return <button type="button" onClick={onClick} disabled={disabled} style={{ padding: compact ? '8px 10px' : '9px 14px', border: primary || danger ? 'none' : '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : bg, color: disabled ? 'var(--text-muted)' : primary || danger ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>{children}</button>
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

function buildExecuteMessage(summary) {
  return [
    'Execute current preview result?',
    '',
    `Planned files     : ${summary.planned || 0}`,
    `Skipped files     : ${summary.skipped || 0}`,
    `Folders to create : ${summary.createFolders || 0}`,
    `Conflicts         : ${summary.conflicts || 0}`,
    `Renamed           : ${summary.renamed || 0}`,
    `Overwritten       : ${summary.overwritten || 0}`,
    `Duplicates        : ${summary.duplicates || 0}`,
    `Errors            : ${summary.error || 0}`,
    '',
    'Only files shown in this preview will be executed.',
  ].join('\n')
}

function EmptyState({ onRun, busy, compact }) {
  return <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: compact ? 18 : 32 }}><div style={{ maxWidth: 500, textAlign: 'center', padding: compact ? 20 : 26, background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-xl)' }}><div style={{ fontSize: compact ? 34 : 42, marginBottom: 12 }}>◌</div><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: compact ? 17 : 20, margin: 0 }}>No preview yet</h3>{!compact && <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>Run preview untuk melihat rencana file tanpa memindahkan apa pun.</p>}<ActionButton onClick={onRun} disabled={busy} primary compact={compact}>{busy ? 'Scanning...' : 'Run Preview'}</ActionButton></div></div>
}

function PreviewTable({ items }) {
  if (!items.length) return <div style={{ padding: 34, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No matching files.</div>
  return <div className="panel-scroll" style={{ height: '100%' }}><table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-surface)' }}><tr>{['Status', 'File', 'Rule', 'Action', 'Destination', 'Note'].map(head => <th key={head} style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>{head}</th>)}</tr></thead><tbody>{items.map(item => { const statusTone = item.status === 'error' ? 'danger' : item.renamed || item.willCreateFolder || item.skipped || item.overwritten ? 'warning' : 'planned'; return <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: '10px 12px', verticalAlign: 'top' }}><Pill tone={statusTone}>{item.status}</Pill></td><td style={{ padding: '10px 12px', verticalAlign: 'top', minWidth: 180 }}><div style={{ fontWeight: 800 }}>{item.fileName}</div><div title={item.sourcePath} style={{ color: 'var(--text-muted)', marginTop: 3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sourcePath}</div></td><td style={{ padding: '10px 12px', verticalAlign: 'top', color: 'var(--text-secondary)', minWidth: 120 }}>{item.ruleName}</td><td style={{ padding: '10px 12px', verticalAlign: 'top' }}><Pill tone="accent">{item.action}</Pill></td><td style={{ padding: '10px 12px', verticalAlign: 'top', minWidth: 320 }}><div title={item.destinationPath} style={{ color: item.status === 'error' ? 'var(--danger)' : 'var(--text-primary)', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.destinationPath || '-'}</div>{item.destinationFolder && <div title={item.destinationFolder} style={{ color: 'var(--text-muted)', marginTop: 3, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.destinationFolder}</div>}</td><td style={{ padding: '10px 12px', verticalAlign: 'top', color: item.status === 'error' ? 'var(--danger)' : 'var(--text-secondary)', minWidth: 220 }}>{item.message}</td></tr> })}</tbody></table></div>
}

function PreviewInspector({ result }) {
  const summary = result?.summary || { planned: 0, skipped: 0, error: 0, createFolders: 0, conflicts: 0, renamed: 0, overwritten: 0, folders: 0 }
  return <div className="panel-scroll" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 18, gap: 14 }}><div><div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800 }}>Summary</div><p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}>Execute hanya setelah preview sesuai.</p></div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}><div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Folders</div><div style={{ marginTop: 5, fontSize: 20, fontWeight: 800 }}>{summary.folders}</div></div><div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}><div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Generated</div><div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-secondary)' }}>{result?.generatedAt ? new Date(result.generatedAt).toLocaleString() : '-'}</div></div></div><div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}><div><Pill tone="planned">planned</Pill> ready</div><div><Pill tone="warning">warning</Pill> create/rename/skip</div><div><Pill tone="danger">error</Pill> fix first</div></div></div>
}

export default function PreviewPage({ compact = false }) {
  const { fetchLogs } = useAppStore()
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const runPreview = async () => { setBusy(true); setError(''); setNotice(''); try { const preview = await window.automover.preview.run(); setResult(preview); if (!preview?.success && preview?.errors?.length) setError(preview.errors[0].error || 'Preview gagal dijalankan'); return preview } catch (err) { setError(err.message); setResult(null); return null } finally { setBusy(false) } }
  const executePreview = async () => {
    const planned = result?.summary?.planned || 0
    const skipped = result?.summary?.skipped || 0
    const errorCount = result?.summary?.error || 0
    if (!planned && !skipped) return
    if (errorCount > 0) return setError('Preview masih memiliki error. Perbaiki rule terlebih dahulu sebelum execute.')
    if (!window.confirm(buildExecuteMessage(result?.summary || {}))) return
    setExecuting(true); setError(''); setNotice('')
    try {
      const executableItems = (result?.items || []).filter(item => item.status === 'planned' || item.status === 'skipped')
      const runResult = await window.automover.preview.execute(executableItems)
      await fetchLogs()
      const successCount = runResult?.success?.length || 0
      const skippedCount = runResult?.skipped?.length || 0
      const errorCountRun = runResult?.errors?.length || 0
      setNotice(`Done: ${successCount} success${skippedCount ? `, ${skippedCount} skipped` : ''}${errorCountRun ? `, ${errorCountRun} error` : ''}.`)
      await runPreview()
    } catch (err) { setError(err.message) } finally { setExecuting(false) }
  }

  const summary = result?.summary || { planned: 0, skipped: 0, error: 0, createFolders: 0, conflicts: 0, renamed: 0, overwritten: 0, duplicates: 0, folders: 0 }
  const items = result?.items || []
  const canExport = Boolean(result && items.length > 0)
  const canExecute = Boolean(result && (summary.planned > 0 || summary.skipped > 0) && summary.error === 0)

  return <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) 300px', overflow: 'hidden' }}><section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}><div style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: compact ? 12 : 18, padding: compact ? '16px 18px 14px' : '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}><div><div style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>Preview</div><h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: compact ? 20 : 23, margin: 0 }}>Dry Run</h1>{!compact && <p style={{ margin: '7px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Simulate first, execute after review.</p>}</div><div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}><ActionButton compact={compact} onClick={() => exportPreviewCsv(result)} disabled={!canExport}>Export</ActionButton><ActionButton compact={compact} onClick={executePreview} disabled={!canExecute || executing || busy} danger>{executing ? 'Executing...' : 'Execute'}</ActionButton><ActionButton compact={compact} onClick={runPreview} disabled={busy || executing} primary>{busy ? 'Scanning...' : 'Run Preview'}</ActionButton></div></div><div style={{ padding: compact ? 14 : 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}><StatCard compact={compact} label="Planned" value={summary.planned} hint="ready" tone="planned" /><StatCard compact={compact} label="Skipped" value={summary.skipped || 0} hint="skip" tone={summary.skipped ? 'warning' : 'neutral'} /><StatCard compact={compact} label="Errors" value={summary.error} hint="check" tone={summary.error ? 'danger' : 'neutral'} /><StatCard compact={compact} label="Folders" value={summary.createFolders} hint="create" tone="warning" /><StatCard compact={compact} label="Conflicts" value={summary.conflicts} hint="found" tone={summary.conflicts ? 'warning' : 'neutral'} /><StatCard compact={compact} label="Renamed" value={summary.renamed} hint="suffix" tone={summary.renamed ? 'warning' : 'neutral'} /></div>{error && <div style={{ margin: compact ? 14 : 18, padding: 12, background: '#ef444418', border: '1px solid #ef444444', color: '#f87171', borderRadius: 'var(--radius)', fontSize: 12 }}>{error}</div>}{notice && <div style={{ margin: compact ? 14 : 18, padding: 12, background: '#22c55e18', border: '1px solid #22c55e44', color: '#4ade80', borderRadius: 'var(--radius)', fontSize: 12 }}>{notice}</div>}<div style={{ flex: 1, minHeight: 0, margin: result ? (compact ? '0 14px 14px' : '0 18px 18px') : 0, background: result ? 'var(--bg-surface)' : 'transparent', border: result ? '1px solid var(--border-subtle)' : 'none', borderRadius: result ? 'var(--radius-xl)' : 0, overflow: 'hidden' }}>{!result ? <EmptyState compact={compact} onRun={runPreview} busy={busy} /> : <PreviewTable items={items} />}</div></section>{!compact && <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden', minHeight: 0 }}><PreviewInspector result={result} /></aside>}</div>
}
