import { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

const S = {
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' },
  input: { width: '100%', background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'DM Sans, sans-serif', userSelect: 'text' },
  inputError: { borderColor: 'var(--danger)' },
  errorMsg: { fontSize: 11, color: 'var(--danger)', marginTop: 4 },
  warnMsg: { fontSize: 11, color: '#f59e0b', marginTop: 4 },
  row: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  browseBtn: { flexShrink: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, padding: '9px 12px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' },
  section: { display: 'flex', flexDirection: 'column', gap: 18 },
}

const STEPS = [
  { id: 'source', title: 'Source', desc: 'Folder yang akan dirapikan' },
  { id: 'match', title: 'Match', desc: 'Kriteria file yang diproses' },
  { id: 'destination', title: 'Destination', desc: 'Lokasi hasil sortir' },
  { id: 'action', title: 'Action', desc: 'Move/copy, konflik nama, dan status rule' },
  { id: 'review', title: 'Review', desc: 'Cek sebelum simpan' },
]

function normalizeExt(raw) {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return null
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

function buildDefault() {
  return {
    id: '',
    name: '',
    watchFolder: '',
    filters: { extensions: [], namePattern: '' },
    action: 'move',
    destination: '',
    organizeBy: 'category',
    destinationBase: 'custom',
    conflictStrategy: 'rename',
    autoCreateFolder: true,
    isActive: true,
  }
}

function OptionCard({ active, title, desc, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: '11px 12px', borderRadius: 'var(--radius)', border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-default)', background: active ? 'var(--accent-muted)' : 'var(--bg-overlay)', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.78, lineHeight: 1.45 }}>{desc}</div>
    </button>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
      <span style={{ width: 40, height: 22, borderRadius: 99, background: value ? 'var(--accent)' : 'var(--bg-overlay)', border: '1px solid var(--border-default)', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </span>
      {label}
    </button>
  )
}

function InfoCard({ title, children }) {
  return (
    <div style={{ padding: '11px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.55, wordBreak: 'break-word' }}>{value || '-'}</div>
    </div>
  )
}

function Stepper({ currentStep, setStep }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
      {STEPS.map((step, index) => {
        const active = index === currentStep
        const done = index < currentStep
        return (
          <button key={step.id} type="button" onClick={() => setStep(index)} style={{ flex: '1 0 92px', minWidth: 92, padding: '9px 10px', borderRadius: 'var(--radius)', border: active ? '1px solid var(--accent)' : '1px solid var(--border-subtle)', background: active ? 'var(--accent-muted)' : done ? 'var(--bg-elevated)' : 'transparent', color: active ? 'var(--accent)' : done ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>{done ? '✓' : `0${index + 1}`}</div>
            <div style={{ fontSize: 12, fontWeight: 800, marginTop: 2 }}>{step.title}</div>
          </button>
        )
      })}
    </div>
  )
}

export default function RuleBuilder({ rule = null, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!rule) return buildDefault()
    return {
      ...buildDefault(),
      ...rule,
      organizeBy: rule.organizeBy ?? rule.groupBy ?? rule.destinationMode ?? 'category',
      destinationBase: rule.destinationBase ?? rule.destinationRoot ?? 'custom',
      conflictStrategy: rule.conflictStrategy ?? 'rename',
      filters: {
        extensions: rule.filters?.extensions ?? [],
        namePattern: rule.filters?.namePattern ?? '',
      },
    }
  })

  const [step, setStep] = useState(0)
  const [extInput, setExtInput] = useState('')
  const [extError, setExtError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const extInputRef = useRef(null)
  const ipcAvailable = typeof window.automover !== 'undefined'

  useEffect(() => {
    if (!rule) {
      setForm(buildDefault())
    } else {
      setForm({
        ...buildDefault(),
        ...rule,
        organizeBy: rule.organizeBy ?? rule.groupBy ?? rule.destinationMode ?? 'category',
        destinationBase: rule.destinationBase ?? rule.destinationRoot ?? 'custom',
        conflictStrategy: rule.conflictStrategy ?? 'rename',
        filters: {
          extensions: rule.filters?.extensions ?? [],
          namePattern: rule.filters?.namePattern ?? '',
        },
      })
    }
    setStep(0)
    setErrors({})
    setExtInput('')
    setExtError('')
  }, [rule?.id])

  const setField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }, [])

  const setFilter = useCallback((key, value) => {
    setForm(prev => ({ ...prev, filters: { ...prev.filters, [key]: value } }))
    setErrors(prev => ({ ...prev, [key === 'namePattern' ? 'namePattern' : key]: undefined }))
  }, [])

  const browseFolder = useCallback(async (fieldKey) => {
    if (!ipcAvailable) return
    const selected = await window.automover.dialog.selectFolder()
    if (selected) setField(fieldKey, selected)
  }, [ipcAvailable, setField])

  const setOrganizeBy = (value) => {
    setForm(prev => ({ ...prev, organizeBy: value, destinationBase: value === 'none' ? 'custom' : prev.destinationBase }))
    setErrors(prev => ({ ...prev, destination: undefined, namePattern: undefined }))
  }

  const addExt = useCallback(() => {
    const ext = normalizeExt(extInput)
    if (!ext) { setExtInput(''); return }
    if (!/^\.[a-zA-Z0-9]+$/.test(ext)) { setExtError('Format tidak valid. Contoh: .pdf'); return }
    if (form.filters.extensions.includes(ext)) { setExtError('Ekstensi sudah ditambahkan'); return }
    setFilter('extensions', [...form.filters.extensions, ext])
    setExtInput('')
    setExtError('')
  }, [extInput, form.filters.extensions, setFilter])

  const removeExt = useCallback((ext) => {
    setFilter('extensions', form.filters.extensions.filter(e => e !== ext))
  }, [form.filters.extensions, setFilter])

  const handleExtKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addExt() }
    if (e.key === 'Backspace' && extInput === '' && form.filters.extensions.length > 0) {
      setFilter('extensions', form.filters.extensions.slice(0, -1))
    }
  }

  const isGroupedMode = ['category', 'extension', 'name'].includes(form.organizeBy)
  const customDestinationRequired = form.destinationBase !== 'source'
  const groupLabel = form.organizeBy === 'category' ? 'kategori' : form.organizeBy === 'extension' ? 'ekstensi' : 'nama file'
  const noFiltersWarning = form.filters.extensions.length === 0 && !form.filters.namePattern.trim()

  const validateAll = () => {
    const errs = {}
    if (!form.watchFolder.trim()) errs.watchFolder = 'Folder sumber wajib diisi'
    if (form.organizeBy === 'name' && !form.filters.namePattern.trim()) errs.namePattern = 'Filter nama wajib diisi untuk mode berdasarkan nama'
    if (customDestinationRequired && !form.destination.trim()) errs.destination = 'Folder tujuan wajib diisi'
    if (customDestinationRequired && form.organizeBy === 'none' && form.watchFolder.trim() && form.destination.trim() && form.watchFolder.trim() === form.destination.trim()) {
      errs.destination = 'Folder tujuan tetap tidak boleh sama dengan folder sumber'
    }
    return errs
  }

  const validateCurrentStep = () => {
    const all = validateAll()
    const current = STEPS[step].id
    const stepErrs = {}
    if (current === 'source' && all.watchFolder) stepErrs.watchFolder = all.watchFolder
    if (current === 'match' && all.namePattern) stepErrs.namePattern = all.namePattern
    if (current === 'destination' && all.destination) stepErrs.destination = all.destination
    if (current === 'review') Object.assign(stepErrs, all)
    setErrors(prev => ({ ...prev, ...stepErrs }))
    return Object.keys(stepErrs).length === 0
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const goBack = () => setStep(s => Math.max(s - 1, 0))

  const handleSave = async () => {
    const errs = validateAll()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const firstErrorStep = errs.watchFolder ? 0 : errs.namePattern ? 1 : errs.destination ? 2 : 4
      setStep(firstErrorStep)
      return
    }

    setSaving(true)
    try {
      await onSave({
        ...form,
        id: form.id || uuidv4(),
        name: form.name.trim(),
        watchFolder: form.watchFolder.trim(),
        destination: form.destinationBase === 'source' ? '' : form.destination.trim(),
        organizeBy: form.organizeBy,
        destinationBase: form.destinationBase,
        conflictStrategy: form.conflictStrategy || 'rename',
        filters: {
          extensions: form.filters.extensions,
          namePattern: form.filters.namePattern.trim(),
        },
      })
    } finally {
      setSaving(false)
    }
  }

  const modeName = {
    category: 'Smart Category',
    extension: 'Berdasarkan ekstensi',
    name: 'Berdasarkan nama file',
    none: 'Folder tetap',
  }[form.organizeBy]

  const conflictName = {
    rename: 'Rename otomatis',
    skip: 'Skip / lewati file bentrok',
    overwrite: 'Overwrite / timpa file lama',
  }[form.conflictStrategy || 'rename']

  const destinationPreview = (() => {
    const base = form.destinationBase === 'source' ? 'Folder sumber' : (form.destination || 'Folder tujuan')
    if (form.organizeBy === 'category') return `${base}/Documents, Images, Videos, ...`
    if (form.organizeBy === 'extension') return `${base}/pdf, jpg, docx, ...`
    if (form.organizeBy === 'name') return `${base}/${form.filters.namePattern.split(',')[0]?.trim() || 'NamaFilter'}`
    return base
  })()

  const renderSourceStep = () => (
    <div style={S.section}>
      <div>
        <label style={S.label}>Nama Aturan <span style={{ color: 'var(--text-muted)', textTransform: 'none', fontWeight: 500 }}>(opsional)</span></label>
        <input style={S.input} type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Contoh: Foto SANOB" />
      </div>
      <div>
        <label style={S.label}>Folder Sumber <span style={{ color: 'var(--danger)' }}>*</span></label>
        <div style={S.row}>
          <input style={{ ...S.input, ...(errors.watchFolder ? S.inputError : {}) }} type="text" value={form.watchFolder} onChange={e => setField('watchFolder', e.target.value)} placeholder="C:\\Users\\Name\\Downloads" />
          <button type="button" style={{ ...S.browseBtn, opacity: ipcAvailable ? 1 : 0.4, cursor: ipcAvailable ? 'pointer' : 'not-allowed' }} onClick={() => browseFolder('watchFolder')} disabled={!ipcAvailable}>📂 Browse</button>
        </div>
        {errors.watchFolder && <p style={S.errorMsg}>{errors.watchFolder}</p>}
      </div>
      <InfoCard title="Nanti bisa dikembangkan">
        Di tahap berikutnya, area ini akan menampung opsi recursive scan dan safety warning jika folder tujuan berada di dalam folder sumber.
      </InfoCard>
    </div>
  )

  const renderMatchStep = () => (
    <div style={S.section}>
      <div>
        <label style={S.label}>Mode Tujuan / Cara Mengelompokkan</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          <OptionCard active={form.organizeBy === 'category'} title="Smart Category" desc="Kelompokkan otomatis ke Documents, Images, Videos, Audio, Archives, Installers, Code, Fonts, dan Others." onClick={() => setOrganizeBy('category')} />
          <OptionCard active={form.organizeBy === 'name'} title="Berdasarkan nama file" desc="Filter nama menjadi nama folder. Contoh: SANOB → folder SANOB." onClick={() => setOrganizeBy('name')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionCard active={form.organizeBy === 'extension'} title="Berdasarkan ekstensi" desc="Membuat/memakai subfolder pdf, docx, jpg, dan sejenisnya." onClick={() => setOrganizeBy('extension')} />
            <OptionCard active={form.organizeBy === 'none'} title="Folder tetap" desc="File yang cocok masuk langsung ke satu folder tujuan." onClick={() => setOrganizeBy('none')} />
          </div>
        </div>
      </div>

      <div>
        <label style={S.label}>Filter Ekstensi</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', padding: '7px 8px', cursor: 'text', minHeight: 42, alignItems: 'center' }} onClick={() => extInputRef.current?.focus()}>
          {form.filters.extensions.map(ext => (
            <span key={ext} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent-muted)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 6px', fontFamily: 'JetBrains Mono, monospace' }}>
              {ext}
              <button type="button" onClick={e => { e.stopPropagation(); removeExt(ext) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '0 1px', lineHeight: 1, fontSize: 12 }}>×</button>
            </span>
          ))}
          <input ref={extInputRef} style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', minWidth: 80, flex: 1 }} type="text" value={extInput} onChange={e => { setExtInput(e.target.value); setExtError('') }} onKeyDown={handleExtKeyDown} onBlur={addExt} placeholder={form.filters.extensions.length === 0 ? '.pdf, .docx, .png...' : ''} />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Biarkan kosong untuk semua tipe file.</p>
        {extError && <p style={S.errorMsg}>{extError}</p>}
      </div>

      <div>
        <label style={S.label}>Filter Nama File {form.organizeBy === 'name' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
        <input style={{ ...S.input, ...(errors.namePattern ? S.inputError : {}) }} type="text" value={form.filters.namePattern} onChange={e => setFilter('namePattern', e.target.value)} placeholder="SANOB atau Invoice_* atau SANOB,ESA" />
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Tanpa wildcard, teks dianggap sebagai “mengandung kata”. Contoh: SANOB cocok dengan SANOB-ESA-49.jpg.</p>
        {errors.namePattern && <p style={S.errorMsg}>{errors.namePattern}</p>}
        {noFiltersWarning && <p style={S.warnMsg}>⚠️ Tidak ada filter aktif — semua file di folder sumber akan diproses.</p>}
      </div>
    </div>
  )

  const renderDestinationStep = () => (
    <div style={S.section}>
      {isGroupedMode && (
        <div>
          <label style={S.label}>Lokasi Subfolder {groupLabel}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionCard active={form.destinationBase === 'custom'} title="Di folder tujuan" desc={`Subfolder ${groupLabel} dibuat/dipakai di folder tujuan.`} onClick={() => setField('destinationBase', 'custom')} />
            <OptionCard active={form.destinationBase === 'source'} title="Di folder sumber" desc={`Subfolder ${groupLabel} dibuat/dipakai di folder sumber.`} onClick={() => setField('destinationBase', 'source')} />
          </div>
        </div>
      )}

      {customDestinationRequired && (
        <div>
          <label style={S.label}>{isGroupedMode ? 'Folder Tujuan Induk' : 'Folder Tujuan Tetap'} <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div style={S.row}>
            <input style={{ ...S.input, ...(errors.destination ? S.inputError : {}) }} type="text" value={form.destination} onChange={e => setField('destination', e.target.value)} placeholder="C:\\Users\\Name\\Documents\\Rapi" />
            <button type="button" style={{ ...S.browseBtn, opacity: ipcAvailable ? 1 : 0.4, cursor: ipcAvailable ? 'pointer' : 'not-allowed' }} onClick={() => browseFolder('destination')} disabled={!ipcAvailable}>📂 Browse</button>
          </div>
          {errors.destination && <p style={S.errorMsg}>{errors.destination}</p>}
        </div>
      )}

      {form.destinationBase === 'source' && isGroupedMode && (
        <InfoCard title="Folder tujuan mengikuti folder sumber">
          File akan dipindahkan ke subfolder dalam folder sumber. Folder lama yang namanya sama akan langsung dipakai.
        </InfoCard>
      )}

      {form.organizeBy === 'name' && (
        <InfoCard title="Contoh mode nama file">
          Filter nama SANOB akan mencocokkan SANOB-ESA-49.jpg dan membuat/memakai folder SANOB.
        </InfoCard>
      )}
    </div>
  )

  const renderActionStep = () => (
    <div style={S.section}>
      <div>
        <label style={S.label}>Tindakan</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <OptionCard active={form.action === 'move'} title="✂️ Pindahkan (Move)" desc="File dihapus dari sumber." onClick={() => setField('action', 'move')} />
          <OptionCard active={form.action === 'copy'} title="📋 Salin (Copy)" desc="File tetap di sumber." onClick={() => setField('action', 'copy')} />
        </div>
      </div>

      <div>
        <label style={S.label}>Jika nama file sudah ada</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          <OptionCard active={(form.conflictStrategy || 'rename') === 'rename'} title="Rename otomatis" desc="File baru diberi suffix. Contoh: laporan_1.pdf." onClick={() => setField('conflictStrategy', 'rename')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionCard active={form.conflictStrategy === 'skip'} title="Skip" desc="File bentrok dilewati, file lama tetap aman." onClick={() => setField('conflictStrategy', 'skip')} />
            <OptionCard active={form.conflictStrategy === 'overwrite'} title="Overwrite" desc="File lama di tujuan akan ditimpa." onClick={() => setField('conflictStrategy', 'overwrite')} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
        <input id="autoCreate" type="checkbox" checked={form.autoCreateFolder} onChange={e => setField('autoCreateFolder', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
        <label htmlFor="autoCreate" style={{ cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Buat folder otomatis</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Jika folder tujuan atau subfolder belum ada, buat secara otomatis. Jika sudah ada, folder itu akan dipakai.</span>
        </label>
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
        <Toggle value={form.isActive} onChange={v => setField('isActive', v)} label={<span><span style={{ fontWeight: 700 }}>Aturan aktif</span><span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{form.isActive ? 'Aturan ini akan berjalan saat monitoring aktif' : 'Aturan ini dinonaktifkan'}</span></span>} />
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div style={S.section}>
      <div style={{ padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        <SummaryRow label="Nama" value={form.name || 'Tanpa nama'} />
        <SummaryRow label="Source" value={form.watchFolder} />
        <SummaryRow label="Mode" value={modeName} />
        <SummaryRow label="Ekstensi" value={form.filters.extensions.length ? form.filters.extensions.join(', ') : 'Semua ekstensi'} />
        <SummaryRow label="Nama file" value={form.filters.namePattern || 'Tidak difilter'} />
        <SummaryRow label="Destination" value={destinationPreview} />
        <SummaryRow label="Action" value={form.action === 'move' ? 'Move / pindahkan' : 'Copy / salin'} />
        <SummaryRow label="Conflict" value={conflictName} />
        <SummaryRow label="Status" value={form.isActive ? 'Aktif' : 'Nonaktif'} />
      </div>
      <InfoCard title="Review sebelum simpan">
        Setelah disimpan, rule ini bisa dicek lewat Preview/Dry Run sebelum benar-benar dijalankan.
      </InfoCard>
    </div>
  )

  const renderStepContent = () => {
    const current = STEPS[step].id
    if (current === 'source') return renderSourceStep()
    if (current === 'match') return renderMatchStep()
    if (current === 'destination') return renderDestinationStep()
    if (current === 'action') return renderActionStep()
    return renderReviewStep()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)' }}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, margin: 0 }}>{rule ? 'Edit Rule' : 'Create Rule'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>{STEPS[step].desc}</p>
      </div>

      <Stepper currentStep={step} setStep={setStep} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
        {renderStepContent()}
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexShrink: 0, background: 'var(--bg-surface)' }}>
        <button type="button" onClick={onCancel} disabled={saving} style={{ padding: '9px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Batal</button>
        <div style={{ flex: 1 }} />
        {step > 0 && <button type="button" onClick={goBack} disabled={saving} style={{ padding: '9px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>← Kembali</button>}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} disabled={saving} style={{ padding: '9px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Lanjut →</button>
        ) : (
          <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '9px 16px', borderRadius: 'var(--radius)', border: 'none', background: saving ? 'var(--accent-muted)' : 'var(--accent)', color: saving ? 'var(--accent)' : '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{saving ? 'Menyimpan...' : rule ? '✓ Simpan Perubahan' : '+ Simpan Rule'}</button>
        )}
      </div>
    </div>
  )
}
