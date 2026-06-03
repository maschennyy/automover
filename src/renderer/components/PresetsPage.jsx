import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import useAppStore from '../store/useAppStore'

const PRESETS = [
  {
    id: 'downloads-cleanup',
    title: 'Rapikan Downloads',
    icon: '📥',
    desc: 'Mengelompokkan isi folder Downloads ke Smart Category seperti Documents, Images, Videos, Archives, dan Others.',
    rule: {
      name: 'Rapikan Downloads',
      filters: { extensions: [], namePattern: '' },
      action: 'move',
      organizeBy: 'category',
      destinationBase: 'source',
      conflictStrategy: 'rename',
      autoCreateFolder: true,
      isActive: true,
    },
  },
  {
    id: 'sanob-photos',
    title: 'Foto SANOB',
    icon: '🖼️',
    desc: 'Memindahkan file foto yang namanya mengandung SANOB ke folder SANOB.',
    rule: {
      name: 'Foto SANOB',
      filters: { extensions: ['.jpg', '.jpeg', '.png', '.heic', '.webp'], namePattern: 'SANOB' },
      action: 'move',
      organizeBy: 'name',
      destinationBase: 'source',
      conflictStrategy: 'rename',
      autoCreateFolder: true,
      isActive: true,
    },
  },
  {
    id: 'kuliah-documents',
    title: 'Dokumen Kuliah',
    icon: '🎓',
    desc: 'Mengelompokkan PDF, Word, Excel, PowerPoint, dan TXT ke folder berdasarkan ekstensi.',
    rule: {
      name: 'Dokumen Kuliah',
      filters: { extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'], namePattern: '' },
      action: 'move',
      organizeBy: 'extension',
      destinationBase: 'source',
      conflictStrategy: 'rename',
      autoCreateFolder: true,
      isActive: true,
    },
  },
  {
    id: 'invoice-billing',
    title: 'Invoice / Billing',
    icon: '🧾',
    desc: 'Mencari file invoice, billing, tagihan, receipt, dan kwitansi lalu mengelompokkan ke folder dari nama filter pertama.',
    rule: {
      name: 'Invoice dan Billing',
      filters: { extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'], namePattern: 'invoice,billing,tagihan,receipt,kwitansi' },
      action: 'move',
      organizeBy: 'name',
      destinationBase: 'source',
      conflictStrategy: 'rename',
      autoCreateFolder: true,
      isActive: true,
    },
  },
  {
    id: 'installers-archives',
    title: 'Installer & Archives',
    icon: '🧩',
    desc: 'Mengelompokkan installer dan file kompresi seperti exe, msi, zip, rar, 7z, dan iso.',
    rule: {
      name: 'Installer dan Archives',
      filters: { extensions: ['.exe', '.msi', '.apk', '.zip', '.rar', '.7z', '.iso'], namePattern: '' },
      action: 'move',
      organizeBy: 'category',
      destinationBase: 'source',
      conflictStrategy: 'rename',
      autoCreateFolder: true,
      isActive: true,
    },
  },
]

function Pill({ children, tone = 'neutral' }) {
  const map = {
    neutral: ['var(--bg-overlay)', 'var(--text-secondary)', 'var(--border-default)'],
    accent: ['var(--accent-muted)', 'var(--accent)', 'var(--accent-border)'],
    green: ['#22c55e18', '#4ade80', '#22c55e44'],
    amber: ['#f59e0b18', '#fbbf24', '#f59e0b44'],
  }
  const [bg, color, border] = map[tone] || map.neutral
  return <span style={{ padding: '4px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}`, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{children}</span>
}

function ActionButton({ children, onClick, disabled, primary = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding: '9px 14px', border: primary ? 'none' : '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : primary ? 'var(--accent)' : 'var(--bg-surface)', color: disabled ? 'var(--text-muted)' : primary ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </button>
  )
}

function modeLabel(mode) {
  if (mode === 'category') return 'Smart Category'
  if (mode === 'extension') return 'By Extension'
  if (mode === 'name') return 'By Name'
  return 'Fixed Folder'
}

function PresetCard({ preset, active, onClick }) {
  const extCount = preset.rule.filters.extensions.length
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 16,
        borderRadius: 'var(--radius-xl)',
        border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)',
        background: active ? 'var(--accent-muted)' : 'var(--bg-surface)',
        color: active ? 'var(--accent)' : 'var(--text-primary)',
        cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? 'rgba(124,58,237,.22)' : 'var(--bg-elevated)', display: 'grid', placeItems: 'center', fontSize: 21 }}>{preset.icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800 }}>{preset.title}</div>
          <div style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)', opacity: active ? 0.88 : 1, fontSize: 12, lineHeight: 1.6, marginTop: 5 }}>{preset.desc}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Pill tone="accent">{modeLabel(preset.rule.organizeBy)}</Pill>
        <Pill tone="green">{preset.rule.action}</Pill>
        {extCount > 0 ? <Pill>{extCount} ext</Pill> : <Pill tone="amber">all files</Pill>}
        {preset.rule.filters.namePattern && <Pill tone="amber">name filter</Pill>}
      </div>
    </button>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.55, wordBreak: 'break-word' }}>{value || '-'}</div>
    </div>
  )
}

export default function PresetsPage() {
  const { addRule, setActiveTab } = useAppStore()
  const [selectedId, setSelectedId] = useState(PRESETS[0].id)
  const [watchFolder, setWatchFolder] = useState('')
  const [destination, setDestination] = useState('')
  const [destinationBase, setDestinationBase] = useState('source')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const selected = useMemo(() => PRESETS.find(p => p.id === selectedId) || PRESETS[0], [selectedId])
  const customDestinationRequired = destinationBase === 'custom'

  const browse = async (setter) => {
    const folder = await window.automover.dialog.selectFolder()
    if (folder) setter(folder)
  }

  const createPresetRule = async () => {
    setNotice('')
    setError('')
    if (!watchFolder.trim()) {
      setError('Folder sumber wajib dipilih terlebih dahulu.')
      return
    }
    if (customDestinationRequired && !destination.trim()) {
      setError('Folder tujuan wajib dipilih jika memakai mode folder tujuan custom.')
      return
    }

    setBusy(true)
    try {
      const baseRule = selected.rule
      const rule = {
        ...baseRule,
        id: uuidv4(),
        watchFolder: watchFolder.trim(),
        destinationBase,
        destination: destinationBase === 'source' ? '' : destination.trim(),
        filters: {
          extensions: [...baseRule.filters.extensions],
          namePattern: baseRule.filters.namePattern,
        },
      }
      const result = await addRule(rule)
      if (!result?.success) throw new Error(result?.error || 'Gagal membuat rule dari preset')
      setNotice(`Preset “${selected.title}” berhasil dibuat sebagai rule aktif. Cek hasilnya di Preview sebelum execute.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, padding: '22px 26px 18px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Presets</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, lineHeight: 1.1, margin: 0 }}>Rule Presets</h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}>Buat rule cepat dari template yang sering dipakai. Preset tidak langsung memindahkan file.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <ActionButton onClick={() => setActiveTab('preview')}>Open Preview</ActionButton>
            <ActionButton onClick={createPresetRule} disabled={busy} primary>{busy ? 'Creating...' : 'Create Rule'}</ActionButton>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: 14 }}>
            {PRESETS.map(preset => <PresetCard key={preset.id} preset={preset} active={preset.id === selectedId} onClick={() => setSelectedId(preset.id)} />)}
          </div>
        </div>
      </section>

      <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'auto', minHeight: 0 }}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800 }}>Preset Setup</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>Pilih folder sumber dan lokasi hasil sebelum membuat rule.</p>
          </div>

          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Folder sumber</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
              <input value={watchFolder} onChange={e => setWatchFolder(e.target.value)} placeholder="C:\\Users\\Name\\Downloads" style={{ flex: 1, minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', padding: '9px 10px', fontSize: 12, outline: 'none' }} />
              <ActionButton onClick={() => browse(setWatchFolder)}>Browse</ActionButton>
            </div>
          </div>

          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Lokasi hasil</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
              <ActionButton onClick={() => setDestinationBase('source')} primary={destinationBase === 'source'}>Folder sumber</ActionButton>
              <ActionButton onClick={() => setDestinationBase('custom')} primary={destinationBase === 'custom'}>Folder tujuan</ActionButton>
            </div>
          </div>

          {customDestinationRequired && (
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Folder tujuan</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="C:\\Users\\Name\\Documents\\Rapi" style={{ flex: 1, minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', padding: '9px 10px', fontSize: 12, outline: 'none' }} />
                <ActionButton onClick={() => browse(setDestination)}>Browse</ActionButton>
              </div>
            </div>
          )}

          {error && <div style={{ padding: 11, background: '#ef444418', border: '1px solid #ef444444', borderRadius: 'var(--radius)', color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>{error}</div>}
          {notice && <div style={{ padding: 11, background: '#22c55e18', border: '1px solid #22c55e44', borderRadius: 'var(--radius)', color: '#4ade80', fontSize: 12, lineHeight: 1.5 }}>{notice}</div>}

          <div style={{ padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <SummaryRow label="Preset" value={selected.title} />
            <SummaryRow label="Mode" value={modeLabel(selected.rule.organizeBy)} />
            <SummaryRow label="Action" value={selected.rule.action} />
            <SummaryRow label="Filter ext" value={selected.rule.filters.extensions.length ? selected.rule.filters.extensions.join(', ') : 'Semua file'} />
            <SummaryRow label="Filter nama" value={selected.rule.filters.namePattern || 'Tidak ada'} />
            <SummaryRow label="Conflict" value={selected.rule.conflictStrategy} />
          </div>

          <ActionButton onClick={createPresetRule} disabled={busy} primary>{busy ? 'Creating...' : 'Create Rule from Preset'}</ActionButton>
        </div>
      </aside>
    </div>
  )
}
