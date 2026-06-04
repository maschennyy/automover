import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import useAppStore from '../store/useAppStore'

const PRESETS = [
  { id: 'downloads-cleanup', title: 'Rapikan Downloads', icon: '📥', desc: 'Kelompokkan Downloads ke kategori otomatis.', rule: { name: 'Rapikan Downloads', filters: { extensions: [], namePattern: '' }, action: 'move', organizeBy: 'category', destinationBase: 'source', conflictStrategy: 'rename', autoCreateFolder: true, isActive: true } },
  { id: 'sanob-photos', title: 'Foto SANOB', icon: '🖼️', desc: 'File foto bernama SANOB ke folder SANOB.', rule: { name: 'Foto SANOB', filters: { extensions: ['.jpg', '.jpeg', '.png', '.heic', '.webp'], namePattern: 'SANOB' }, action: 'move', organizeBy: 'name', destinationBase: 'source', conflictStrategy: 'rename', autoCreateFolder: true, isActive: true } },
  { id: 'kuliah-documents', title: 'Dokumen Kuliah', icon: '🎓', desc: 'PDF, Word, Excel, PPT, dan TXT per ekstensi.', rule: { name: 'Dokumen Kuliah', filters: { extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'], namePattern: '' }, action: 'move', organizeBy: 'extension', destinationBase: 'source', conflictStrategy: 'rename', autoCreateFolder: true, isActive: true } },
  { id: 'invoice-billing', title: 'Invoice / Billing', icon: '🧾', desc: 'Invoice, billing, tagihan, receipt, kwitansi.', rule: { name: 'Invoice dan Billing', filters: { extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'], namePattern: 'invoice,billing,tagihan,receipt,kwitansi' }, action: 'move', organizeBy: 'name', destinationBase: 'source', conflictStrategy: 'rename', autoCreateFolder: true, isActive: true } },
  { id: 'installers-archives', title: 'Installer & Archives', icon: '🧩', desc: 'EXE, MSI, ZIP, RAR, 7Z, ISO.', rule: { name: 'Installer dan Archives', filters: { extensions: ['.exe', '.msi', '.apk', '.zip', '.rar', '.7z', '.iso'], namePattern: '' }, action: 'move', organizeBy: 'category', destinationBase: 'source', conflictStrategy: 'rename', autoCreateFolder: true, isActive: true } },
  { id: 'reference-list', title: 'Reference List TXT/CSV', icon: '📋', desc: 'Buat rule dari daftar keyword.', rule: { name: 'Reference List', filters: { extensions: [], namePattern: '' }, action: 'move', organizeBy: 'name', destinationBase: 'source', conflictStrategy: 'rename', autoCreateFolder: true, isActive: true } },
]

function Pill({ children, tone = 'neutral' }) {
  const map = { neutral: ['var(--bg-overlay)', 'var(--text-secondary)', 'var(--border-default)'], accent: ['var(--accent-muted)', 'var(--accent)', 'var(--accent-border)'], green: ['#22c55e18', '#4ade80', '#22c55e44'], amber: ['#f59e0b18', '#fbbf24', '#f59e0b44'] }
  const [bg, color, border] = map[tone] || map.neutral
  return <span style={{ padding: '4px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}`, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{children}</span>
}

function ActionButton({ children, onClick, disabled, primary = false, compact = false }) {
  return <button type="button" onClick={onClick} disabled={disabled} style={{ padding: compact ? '8px 10px' : '9px 14px', border: primary ? 'none' : '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : primary ? 'var(--accent)' : 'var(--bg-surface)', color: disabled ? 'var(--text-muted)' : primary ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>{children}</button>
}

function modeLabel(mode) {
  if (mode === 'category') return 'Category'
  if (mode === 'extension') return 'Extension'
  if (mode === 'name') return 'Name'
  return 'Fixed'
}

function parseReferenceList(text) {
  return [...new Set(String(text || '').split(/[\n,;\t]+/).map(v => v.trim()).filter(Boolean).map(v => v.replace(/^"|"$/g, '').trim()).filter(Boolean))]
}

function PresetCard({ preset, active, onClick, compact }) {
  const extCount = preset.rule.filters.extensions.length
  return (
    <button type="button" onClick={onClick} style={{ textAlign: 'left', padding: compact ? 13 : 15, borderRadius: 'var(--radius-xl)', border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)', background: active ? 'var(--accent-muted)' : 'var(--bg-surface)', color: active ? 'var(--accent)' : 'var(--text-primary)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
        <div style={{ width: compact ? 34 : 38, height: compact ? 34 : 38, borderRadius: 11, background: active ? 'rgba(124,58,237,.22)' : 'var(--bg-elevated)', display: 'grid', placeItems: 'center', fontSize: compact ? 18 : 21, flexShrink: 0 }}>{preset.icon}</div>
        <div style={{ minWidth: 0 }}><div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.title}</div>{!compact && <div style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)', opacity: active ? 0.88 : 1, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>{preset.desc}</div>}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Pill tone="accent">{modeLabel(preset.rule.organizeBy)}</Pill><Pill tone="green">{preset.rule.action}</Pill>{extCount > 0 ? <Pill>{extCount} ext</Pill> : <Pill tone="amber">all</Pill>}{preset.rule.filters.namePattern && <Pill tone="amber">name</Pill>}{preset.id === 'reference-list' && <Pill tone="amber">txt/csv</Pill>}</div>
    </button>
  )
}

function SummaryRow({ label, value }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}><div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div><div style={{ color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }}>{value || '-'}</div></div>
}

function SetupPanel({ compact, selected, watchFolder, setWatchFolder, destination, setDestination, destinationBase, setDestinationBase, referenceText, setReferenceText, referenceItems, isReferencePreset, customDestinationRequired, error, notice, busy, browse, importReferenceFile, createPresetRule }) {
  return (
    <div className="panel-scroll" style={{ padding: compact ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div><div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800 }}>Setup</div>{!compact && <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}>Pilih folder sebelum membuat rule.</p>}</div>
      <div><label style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Source</label><div style={{ display: 'flex', gap: 8, marginTop: 7 }}><input value={watchFolder} onChange={e => setWatchFolder(e.target.value)} placeholder="Source folder" style={{ flex: 1, minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', padding: '9px 10px', fontSize: 12, outline: 'none' }} /><ActionButton compact={compact} onClick={() => browse(setWatchFolder)}>Browse</ActionButton></div></div>
      <div><label style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Destination</label><div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}><ActionButton compact={compact} onClick={() => setDestinationBase('source')} primary={destinationBase === 'source'}>Source</ActionButton><ActionButton compact={compact} onClick={() => setDestinationBase('custom')} primary={destinationBase === 'custom'}>Custom</ActionButton></div></div>
      {customDestinationRequired && <div><label style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Custom folder</label><div style={{ display: 'flex', gap: 8, marginTop: 7 }}><input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination folder" style={{ flex: 1, minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', padding: '9px 10px', fontSize: 12, outline: 'none' }} /><ActionButton compact={compact} onClick={() => browse(setDestination)}>Browse</ActionButton></div></div>}
      {isReferencePreset && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Reference List</label><textarea value={referenceText} onChange={e => setReferenceText(e.target.value)} placeholder={'SANOB\nFIY4847\nINVOICE-PLN'} rows={compact ? 6 : 8} style={{ resize: 'vertical', background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', padding: '9px 10px', fontSize: 12, outline: 'none', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }} /><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><label style={{ padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Import<input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={importReferenceFile} style={{ display: 'none' }} /></label><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{referenceItems.length} keywords</span></div></div>}
      {error && <div style={{ padding: 11, background: '#ef444418', border: '1px solid #ef444444', borderRadius: 'var(--radius)', color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>{error}</div>}
      {notice && <div style={{ padding: 11, background: '#22c55e18', border: '1px solid #22c55e44', borderRadius: 'var(--radius)', color: '#4ade80', fontSize: 12, lineHeight: 1.5 }}>{notice}</div>}
      <div style={{ padding: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}><SummaryRow label="Preset" value={selected.title} /><SummaryRow label="Mode" value={modeLabel(selected.rule.organizeBy)} /><SummaryRow label="Action" value={selected.rule.action} /><SummaryRow label="Ext" value={selected.rule.filters.extensions.length ? selected.rule.filters.extensions.join(', ') : 'All'} /><SummaryRow label="Name" value={isReferencePreset ? `${referenceItems.length} keyword` : selected.rule.filters.namePattern || '-'} /></div>
      <ActionButton compact={compact} onClick={createPresetRule} disabled={busy} primary>{busy ? 'Creating...' : 'Create Rule'}</ActionButton>
    </div>
  )
}

export default function PresetsPage({ compact = false }) {
  const { addRule, setActiveTab } = useAppStore()
  const [selectedId, setSelectedId] = useState(PRESETS[0].id)
  const [watchFolder, setWatchFolder] = useState('')
  const [destination, setDestination] = useState('')
  const [destinationBase, setDestinationBase] = useState('source')
  const [referenceText, setReferenceText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const selected = useMemo(() => PRESETS.find(p => p.id === selectedId) || PRESETS[0], [selectedId])
  const customDestinationRequired = destinationBase === 'custom'
  const isReferencePreset = selected.id === 'reference-list'
  const referenceItems = useMemo(() => parseReferenceList(referenceText), [referenceText])

  const browse = async (setter) => { const folder = await window.automover.dialog.selectFolder(); if (folder) setter(folder) }
  const importReferenceFile = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { const text = await file.text(); const current = referenceText.trim(); setReferenceText(current ? `${current}\n${text}` : text); setNotice(`${parseReferenceList(text).length} keyword imported.`) } catch (err) { setError(`Gagal membaca file: ${err.message}`) } }
  const createPresetRule = async () => {
    setNotice(''); setError('')
    if (!watchFolder.trim()) return setError('Source folder wajib dipilih.')
    if (customDestinationRequired && !destination.trim()) return setError('Custom destination wajib dipilih.')
    if (isReferencePreset && referenceItems.length === 0) return setError('Reference List masih kosong.')
    setBusy(true)
    try {
      const baseRule = selected.rule
      const namePattern = isReferencePreset ? referenceItems.join(',') : baseRule.filters.namePattern
      const rule = { ...baseRule, id: uuidv4(), name: isReferencePreset ? `Reference List (${referenceItems.length})` : baseRule.name, watchFolder: watchFolder.trim(), destinationBase, destination: destinationBase === 'source' ? '' : destination.trim(), filters: { extensions: [...baseRule.filters.extensions], namePattern } }
      const result = await addRule(rule)
      if (!result?.success) throw new Error(result?.error || 'Gagal membuat rule')
      setNotice(`Rule created. Check Preview before execute.`)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const setupProps = { compact, selected, watchFolder, setWatchFolder, destination, setDestination, destinationBase, setDestinationBase, referenceText, setReferenceText, referenceItems, isReferencePreset, customDestinationRequired, error, notice, busy, browse, importReferenceFile, createPresetRule }

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) 320px', overflow: 'hidden' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: compact ? 12 : 18, padding: compact ? '16px 18px 14px' : '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}><div><div style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>Presets</div><h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: compact ? 20 : 23, margin: 0 }}>Rule Presets</h1>{!compact && <p style={{ margin: '7px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Create rule templates without moving files.</p>}</div><div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}><ActionButton compact={compact} onClick={() => setActiveTab('preview')}>Preview</ActionButton><ActionButton compact={compact} onClick={createPresetRule} disabled={busy} primary>{busy ? 'Creating...' : 'Create Rule'}</ActionButton></div></div>
        {compact && <div style={{ borderBottom: '1px solid var(--border-subtle)', maxHeight: '42vh' }}><SetupPanel {...setupProps} /></div>}
        <div className="panel-scroll" style={{ flex: 1, minHeight: 0, padding: compact ? 14 : 20 }}><div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>{PRESETS.map(preset => <PresetCard compact={compact} key={preset.id} preset={preset} active={preset.id === selectedId} onClick={() => { setSelectedId(preset.id); setNotice(''); setError('') }} />)}</div></div>
      </section>
      {!compact && <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden', minHeight: 0 }}><SetupPanel {...setupProps} /></aside>}
    </div>
  )
}
