import { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

// ─── Shared style tokens ──────────────────────────────────────────────────────
const S = {
  label: {
    display:      'block',
    fontSize:     12,
    fontWeight:   600,
    color:        'var(--text-secondary)',
    marginBottom: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    width:        '100%',
    background:   'var(--bg-overlay)',
    border:       '1px solid var(--border-default)',
    borderRadius: 'var(--radius)',
    color:        'var(--text-primary)',
    fontSize:     13,
    padding:      '8px 12px',
    outline:      'none',
    fontFamily:   'DM Sans, sans-serif',
    transition:   'border-color 0.15s',
    userSelect:   'text',
  },
  inputError: {
    borderColor: 'var(--danger)',
  },
  errorMsg: {
    fontSize:   11,
    color:      'var(--danger)',
    marginTop:  4,
  },
  warnMsg: {
    fontSize:   11,
    color:      '#f59e0b',
    marginTop:  4,
  },
  row: {
    display:        'flex',
    gap:            8,
    alignItems:     'flex-start',
  },
  browseBtn: {
    flexShrink:   0,
    background:   'var(--bg-overlay)',
    border:       '1px solid var(--border-default)',
    borderRadius: 'var(--radius)',
    color:        'var(--text-secondary)',
    fontSize:     12,
    fontWeight:   500,
    padding:      '8px 12px',
    cursor:       'pointer',
    whiteSpace:   'nowrap',
    fontFamily:   'DM Sans, sans-serif',
    transition:   'background 0.15s, color 0.15s',
    marginTop:    0,
  },
}

function normalizeExt(raw) {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return null
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        background: 'none',
        border:     'none',
        cursor:     'pointer',
        padding:    0,
        color:      'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif',
        fontSize:   13,
      }}
    >
      <span style={{
        width:        40,
        height:       22,
        borderRadius: 99,
        background:   value ? 'var(--accent)' : 'var(--bg-overlay)',
        border:       '1px solid var(--border-default)',
        position:     'relative',
        transition:   'background 0.2s',
        flexShrink:   0,
      }}>
        <span style={{
          position:     'absolute',
          top:          2,
          left:         value ? 20 : 2,
          width:        16,
          height:       16,
          borderRadius: '50%',
          background:   '#fff',
          transition:   'left 0.18s',
          boxShadow:    '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </span>
      {label}
    </button>
  )
}

function OptionCard({ active, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex:          1,
        padding:       '10px 12px',
        borderRadius:  'var(--radius)',
        border:        active ? '1.5px solid var(--accent)' : '1px solid var(--border-default)',
        background:    active ? 'var(--accent-muted)' : 'var(--bg-overlay)',
        color:         active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor:        'pointer',
        textAlign:     'left',
        fontFamily:    'DM Sans, sans-serif',
        transition:    'all 0.15s',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11, marginTop: 3, opacity: 0.75, lineHeight: 1.45 }}>{desc}</div>
    </button>
  )
}

function buildDefault() {
  return {
    id:               '',
    name:             '',
    watchFolder:      '',
    filters: {
      extensions:  [],
      namePattern: '',
    },
    action:           'move',
    destination:      '',
    organizeBy:       'extension', // 'extension' | 'none'
    destinationBase:  'custom',    // 'custom' | 'source'
    autoCreateFolder: true,
    isActive:         true,
  }
}

export default function RuleBuilder({ rule = null, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (rule) {
      return {
        ...buildDefault(),
        ...rule,
        organizeBy:      rule.organizeBy ?? rule.groupBy ?? rule.destinationMode ?? 'extension',
        destinationBase: rule.destinationBase ?? rule.destinationRoot ?? 'custom',
        filters: {
          extensions:  rule.filters?.extensions  ?? [],
          namePattern: rule.filters?.namePattern ?? '',
        },
      }
    }
    return buildDefault()
  })

  const [extInput, setExtInput] = useState('')
  const [extError, setExtError] = useState('')
  const extInputRef = useRef(null)

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const ipcAvailable = typeof window.automover !== 'undefined'

  useEffect(() => {
    if (rule) {
      setForm({
        ...buildDefault(),
        ...rule,
        organizeBy:      rule.organizeBy ?? rule.groupBy ?? rule.destinationMode ?? 'extension',
        destinationBase: rule.destinationBase ?? rule.destinationRoot ?? 'custom',
        filters: {
          extensions:  rule.filters?.extensions  ?? [],
          namePattern: rule.filters?.namePattern ?? '',
        },
      })
    } else {
      setForm(buildDefault())
    }
    setErrors({})
    setExtInput('')
    setExtError('')
  }, [rule?.id])

  const setField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }, [])

  const setFilter = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
    }))
  }, [])

  const browseFolder = useCallback(async (fieldKey) => {
    if (!ipcAvailable) return
    const path = await window.automover.dialog.selectFolder()
    if (path) setField(fieldKey, path)
  }, [ipcAvailable, setField])

  const setOrganizeBy = (value) => {
    setForm(prev => ({
      ...prev,
      organizeBy: value,
      destinationBase: value === 'none' ? 'custom' : prev.destinationBase,
    }))
    setErrors(prev => ({ ...prev, destination: undefined }))
  }

  const addExt = useCallback(() => {
    const ext = normalizeExt(extInput)
    if (!ext) { setExtInput(''); return }

    if (!/^\.[a-zA-Z0-9]+$/.test(ext)) {
      setExtError('Format tidak valid. Contoh: .pdf')
      return
    }
    if (form.filters.extensions.includes(ext)) {
      setExtError('Ekstensi sudah ditambahkan')
      return
    }
    setFilter('extensions', [...form.filters.extensions, ext])
    setExtInput('')
    setExtError('')
  }, [extInput, form.filters.extensions, setFilter])

  const removeExt = useCallback((ext) => {
    setFilter('extensions', form.filters.extensions.filter(e => e !== ext))
  }, [form.filters.extensions, setFilter])

  const handleExtKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addExt()
    }
    if (e.key === 'Backspace' && extInput === '' && form.filters.extensions.length > 0) {
      setFilter('extensions', form.filters.extensions.slice(0, -1))
    }
  }

  const validate = () => {
    const errs = {}
    if (!form.watchFolder.trim()) errs.watchFolder = 'Folder sumber wajib diisi'

    const needsCustomDestination = form.destinationBase !== 'source'
    if (needsCustomDestination && !form.destination.trim()) {
      errs.destination = 'Folder tujuan wajib diisi'
    }

    if (
      needsCustomDestination &&
      form.organizeBy === 'none' &&
      form.watchFolder.trim() &&
      form.destination.trim() &&
      form.watchFolder.trim() === form.destination.trim()
    ) {
      errs.destination = 'Folder tujuan tetap tidak boleh sama dengan folder sumber'
    }

    return errs
  }

  const noFiltersWarning =
    form.filters.extensions.length === 0 && !form.filters.namePattern.trim()

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSaving(true)
    try {
      const finalRule = {
        ...form,
        id:              form.id || uuidv4(),
        name:            form.name.trim(),
        watchFolder:     form.watchFolder.trim(),
        destination:     form.destinationBase === 'source' ? '' : form.destination.trim(),
        organizeBy:      form.organizeBy,
        destinationBase: form.destinationBase,
        filters: {
          extensions:  form.filters.extensions,
          namePattern: form.filters.namePattern.trim(),
        },
      }
      await onSave(finalRule)
    } finally {
      setSaving(false)
    }
  }

  const customDestinationRequired = form.destinationBase !== 'source'

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      height:         '100%',
      background:     'var(--bg-surface)',
      borderLeft:     '1px solid var(--border-subtle)',
    }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, margin: 0 }}>
          {rule ? 'Edit Aturan' : 'Buat Aturan Baru'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
          {rule ? `Mengedit: ${rule.name || rule.id}` : 'Tentukan kondisi dan tindakan sortir file'}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <label style={S.label}>Nama Aturan <span style={{ color: 'var(--text-muted)', textTransform: 'none', fontWeight: 400 }}>(opsional)</span></label>
            <input
              style={S.input}
              type="text"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Contoh: Rapikan folder Downloads"
            />
          </div>

          <div>
            <label style={S.label}>Folder Sumber <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={S.row}>
              <div style={{ flex: 1 }}>
                <input
                  style={{ ...S.input, ...(errors.watchFolder ? S.inputError : {}) }}
                  type="text"
                  value={form.watchFolder}
                  onChange={e => setField('watchFolder', e.target.value)}
                  placeholder="C:\\Users\\Name\\Downloads"
                />
              </div>
              <button
                type="button"
                style={{ ...S.browseBtn, opacity: ipcAvailable ? 1 : 0.4, cursor: ipcAvailable ? 'pointer' : 'not-allowed' }}
                onClick={() => browseFolder('watchFolder')}
                disabled={!ipcAvailable}
              >
                📂 Browse
              </button>
            </div>
            {errors.watchFolder && <p style={S.errorMsg}>{errors.watchFolder}</p>}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0 -4px' }} />

          <div>
            <label style={S.label}>Mode Tujuan</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <OptionCard
                active={form.organizeBy === 'none'}
                title="Folder tetap"
                desc="File yang cocok masuk langsung ke satu folder tujuan."
                onClick={() => setOrganizeBy('none')}
              />
              <OptionCard
                active={form.organizeBy === 'extension'}
                title="Berdasarkan ekstensi"
                desc="Aplikasi membuat/memakai subfolder pdf, docx, jpg, dan sejenisnya."
                onClick={() => setOrganizeBy('extension')}
              />
            </div>
          </div>

          {form.organizeBy === 'extension' && (
            <div>
              <label style={S.label}>Lokasi Subfolder Ekstensi</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <OptionCard
                  active={form.destinationBase === 'custom'}
                  title="Di folder tujuan"
                  desc="Contoh: D:/Rapi/pdf, D:/Rapi/docx."
                  onClick={() => setField('destinationBase', 'custom')}
                />
                <OptionCard
                  active={form.destinationBase === 'source'}
                  title="Di folder sumber"
                  desc="Contoh: Downloads/pdf, Downloads/docx."
                  onClick={() => setField('destinationBase', 'source')}
                />
              </div>
            </div>
          )}

          {customDestinationRequired && (
            <div>
              <label style={S.label}>
                {form.organizeBy === 'extension' ? 'Folder Tujuan Induk' : 'Folder Tujuan Tetap'} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={S.row}>
                <div style={{ flex: 1 }}>
                  <input
                    style={{ ...S.input, ...(errors.destination ? S.inputError : {}) }}
                    type="text"
                    value={form.destination}
                    onChange={e => setField('destination', e.target.value)}
                    placeholder="C:\\Users\\Name\\Documents\\Rapi"
                  />
                </div>
                <button
                  type="button"
                  style={{ ...S.browseBtn, opacity: ipcAvailable ? 1 : 0.4, cursor: ipcAvailable ? 'pointer' : 'not-allowed' }}
                  onClick={() => browseFolder('destination')}
                  disabled={!ipcAvailable}
                >
                  📂 Browse
                </button>
              </div>
              {errors.destination && <p style={S.errorMsg}>{errors.destination}</p>}
              {form.organizeBy === 'extension' && (
                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                  Subfolder ekstensi akan dibuat di dalam folder ini. Folder yang sudah ada akan langsung dipakai.
                </p>
              )}
            </div>
          )}

          {form.organizeBy === 'extension' && form.destinationBase === 'source' && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                Folder tujuan mengikuti folder sumber
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                File akan dipindahkan ke subfolder dalam folder sumber. Contoh: Downloads/pdf atau Downloads/docx.
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0 -4px' }} />

          <div>
            <label style={S.label}>Filter Ekstensi</label>
            <div
              style={{
                display:      'flex',
                flexWrap:     'wrap',
                gap:          6,
                background:   'var(--bg-overlay)',
                border:       '1px solid var(--border-default)',
                borderRadius: 'var(--radius)',
                padding:      '6px 8px',
                cursor:       'text',
                minHeight:    40,
                alignItems:   'center',
              }}
              onClick={() => extInputRef.current?.focus()}
            >
              {form.filters.extensions.map(ext => (
                <span key={ext} style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          4,
                  background:   'var(--accent-muted)',
                  border:       '1px solid var(--accent-border)',
                  color:        'var(--accent)',
                  borderRadius: 4,
                  fontSize:     11,
                  fontWeight:   600,
                  padding:      '2px 6px',
                  fontFamily:   'JetBrains Mono, monospace',
                  userSelect:   'none',
                }}>
                  {ext}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeExt(ext) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '0 1px', lineHeight: 1, fontSize: 12 }}
                    title={`Hapus ${ext}`}
                  >×</button>
                </span>
              ))}
              <input
                ref={extInputRef}
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', minWidth: 80, flex: 1, userSelect: 'text' }}
                type="text"
                value={extInput}
                onChange={e => { setExtInput(e.target.value); setExtError('') }}
                onKeyDown={handleExtKeyDown}
                onBlur={addExt}
                placeholder={form.filters.extensions.length === 0 ? '.pdf, .docx, .png...' : ''}
              />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              Ketik ekstensi lalu tekan Enter atau koma. Biarkan kosong untuk semua tipe file.
            </p>
            {extError && <p style={S.errorMsg}>{extError}</p>}
          </div>

          <div>
            <label style={S.label}>Filter Nama File</label>
            <input
              style={S.input}
              type="text"
              value={form.filters.namePattern}
              onChange={e => setFilter('namePattern', e.target.value)}
              placeholder="Invoice_*  atau  Report_2024*"
            />
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              Gunakan * sebagai wildcard. Biarkan kosong untuk tidak memfilter nama.
            </p>
            {noFiltersWarning && (
              <p style={S.warnMsg}>⚠️ Tidak ada filter aktif — semua file di folder sumber akan diproses</p>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0 -4px' }} />

          <div>
            <label style={S.label}>Tindakan</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <OptionCard
                active={form.action === 'move'}
                title="✂️ Pindahkan (Move)"
                desc="File dihapus dari sumber."
                onClick={() => setField('action', 'move')}
              />
              <OptionCard
                active={form.action === 'copy'}
                title="📋 Salin (Copy)"
                desc="File tetap di sumber."
                onClick={() => setField('action', 'copy')}
              />
            </div>
          </div>

          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 14px',
            background:   'var(--bg-elevated)',
            borderRadius: 'var(--radius)',
            border:       '1px solid var(--border-subtle)',
          }}>
            <input
              id="autoCreate"
              type="checkbox"
              checked={form.autoCreateFolder}
              onChange={e => setField('autoCreateFolder', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
            />
            <label htmlFor="autoCreate" style={{ cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Buat folder otomatis</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                Jika folder tujuan atau subfolder ekstensi belum ada, buat secara otomatis. Jika sudah ada, folder itu akan dipakai.
              </span>
            </label>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
            <Toggle
              value={form.isActive}
              onChange={v => setField('isActive', v)}
              label={
                <span>
                  <span style={{ fontWeight: 500 }}>Aturan aktif</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {form.isActive ? 'Aturan ini akan berjalan saat monitoring aktif' : 'Aturan ini dinonaktifkan'}
                  </span>
                </span>
              }
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexShrink: 0, background: 'var(--bg-surface)' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 2, padding: '9px 0', borderRadius: 'var(--radius)', border: 'none', background: saving ? 'var(--accent-muted)' : 'var(--accent)', color: saving ? 'var(--accent)' : '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s' }}
        >
          {saving ? 'Menyimpan...' : rule ? '✓ Simpan Perubahan' : '+ Simpan Aturan'}
        </button>
      </div>
    </div>
  )
}
