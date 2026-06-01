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
    color:      'var(--warning)',
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

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
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
      {/* Track */}
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
        {/* Thumb */}
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

// ─── Default state factory ─────────────────────────────────────────────────
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
    autoCreateFolder: true,
    isActive:         true,
  }
}

// ─── RuleBuilder component ─────────────────────────────────────────────────
/**
 * Props:
 *   rule     : Rule | null   — null = create mode, object = edit mode
 *   onSave   : (rule) => void
 *   onCancel : () => void
 */
export default function RuleBuilder({ rule = null, onSave, onCancel }) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState(() => {
    if (rule) {
      return {
        ...buildDefault(),
        ...rule,
        filters: {
          extensions:  rule.filters?.extensions  ?? [],
          namePattern: rule.filters?.namePattern ?? '',
        },
      }
    }
    return buildDefault()
  })

  // ── Ext tag-input state ────────────────────────────────────────────────────
  const [extInput, setExtInput]   = useState('')
  const [extError, setExtError]   = useState('')
  const extInputRef               = useRef(null)

  // ── Validation errors ──────────────────────────────────────────────────────
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const ipcAvailable              = typeof window.automover !== 'undefined'

  // ── Re-init if rule prop changes (e.g. open different rule in same mount) ──
  useEffect(() => {
    if (rule) {
      setForm({
        ...buildDefault(),
        ...rule,
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
  }, [rule?.id])

  // ── Field helpers ──────────────────────────────────────────────────────────
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

  // ── Browse folder ──────────────────────────────────────────────────────────
  const browseFolder = useCallback(async (fieldKey) => {
    if (!ipcAvailable) return
    const path = await window.automover.dialog.selectFolder()
    if (path) {
      setField(fieldKey, path)
    }
  }, [ipcAvailable, setField])

  // ── Extension tag-input logic ──────────────────────────────────────────────
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
    // Backspace on empty input removes last ext
    if (e.key === 'Backspace' && extInput === '' && form.filters.extensions.length > 0) {
      setFilter('extensions', form.filters.extensions.slice(0, -1))
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {}
    if (!form.watchFolder.trim())   errs.watchFolder   = 'Folder sumber wajib diisi'
    if (!form.destination.trim())   errs.destination   = 'Folder tujuan wajib diisi'
    if (
      form.watchFolder.trim() &&
      form.destination.trim() &&
      form.watchFolder.trim() === form.destination.trim()
    ) {
      errs.destination = 'Folder tujuan tidak boleh sama dengan folder sumber'
    }
    return errs
  }

  const noFiltersWarning =
    form.filters.extensions.length === 0 && !form.filters.namePattern.trim()

  // ── Submit ─────────────────────────────────────────────────────────────────
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
        id:          form.id || uuidv4(),
        name:        form.name.trim(),
        watchFolder: form.watchFolder.trim(),
        destination: form.destination.trim(),
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      height:         '100%',
      background:     'var(--bg-surface)',
      borderLeft:     '1px solid var(--border-subtle)',
    }}>
      {/* Header */}
      <div style={{
        padding:      '20px 24px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink:   0,
      }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, margin: 0 }}>
          {rule ? 'Edit Aturan' : 'Buat Aturan Baru'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
          {rule ? `Mengedit: ${rule.name || rule.id}` : 'Tentukan kondisi dan tindakan sortir file'}
        </p>
      </div>

      {/* Scrollable form body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Rule Name */}
          <div>
            <label style={S.label}>Nama Aturan <span style={{ color: 'var(--text-muted)', textTransform: 'none', fontWeight: 400 }}>(opsional)</span></label>
            <input
              style={S.input}
              type="text"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Contoh: PDF ke Dokumen"
            />
          </div>

          {/* Watch Folder */}
          <div>
            <label style={S.label}>Folder Sumber <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={S.row}>
              <div style={{ flex: 1 }}>
                <input
                  style={{ ...S.input, ...(errors.watchFolder ? S.inputError : {}) }}
                  type="text"
                  value={form.watchFolder}
                  onChange={e => setField('watchFolder', e.target.value)}
                  placeholder="C:\Users\Name\Downloads"
                />
              </div>
              <button
                type="button"
                style={{
                  ...S.browseBtn,
                  opacity: ipcAvailable ? 1 : 0.4,
                  cursor:  ipcAvailable ? 'pointer' : 'not-allowed',
                  marginTop: 0,
                  alignSelf: 'flex-start',
                }}
                onClick={() => browseFolder('watchFolder')}
                disabled={!ipcAvailable}
                title={!ipcAvailable ? 'Ketik path secara manual' : 'Pilih folder'}
              >
                📂 Browse
              </button>
            </div>
            {errors.watchFolder && <p style={S.errorMsg}>{errors.watchFolder}</p>}
          </div>

          {/* Destination Folder */}
          <div>
            <label style={S.label}>Folder Tujuan <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={S.row}>
              <div style={{ flex: 1 }}>
                <input
                  style={{ ...S.input, ...(errors.destination ? S.inputError : {}) }}
                  type="text"
                  value={form.destination}
                  onChange={e => setField('destination', e.target.value)}
                  placeholder="C:\Users\Name\Documents"
                />
              </div>
              <button
                type="button"
                style={{
                  ...S.browseBtn,
                  opacity: ipcAvailable ? 1 : 0.4,
                  cursor:  ipcAvailable ? 'pointer' : 'not-allowed',
                  alignSelf: 'flex-start',
                }}
                onClick={() => browseFolder('destination')}
                disabled={!ipcAvailable}
                title={!ipcAvailable ? 'Ketik path secara manual' : 'Pilih folder'}
              >
                📂 Browse
              </button>
            </div>
            {errors.destination && <p style={S.errorMsg}>{errors.destination}</p>}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0 -4px' }} />

          {/* Extensions tag-input */}
          <div>
            <label style={S.label}>Filter Ekstensi</label>
            {/* Chip container + input */}
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
                    style={{
                      background: 'none',
                      border:     'none',
                      cursor:     'pointer',
                      color:      'var(--accent)',
                      padding:    '0 1px',
                      lineHeight: 1,
                      fontSize:   12,
                    }}
                    title={`Hapus ${ext}`}
                  >×</button>
                </span>
              ))}
              <input
                ref={extInputRef}
                style={{
                  background:  'none',
                  border:      'none',
                  outline:     'none',
                  color:       'var(--text-primary)',
                  fontSize:    13,
                  fontFamily:  'JetBrains Mono, monospace',
                  minWidth:    80,
                  flex:        1,
                  userSelect:  'text',
                }}
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

          {/* Name Pattern */}
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
              <p style={S.warnMsg}>
                ⚠️ Tidak ada filter aktif — semua file di folder sumber akan diproses
              </p>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0 -4px' }} />

          {/* Action: Move / Copy */}
          <div>
            <label style={S.label}>Tindakan</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'move', label: '✂️ Pindahkan (Move)', desc: 'File dihapus dari sumber' },
                { value: 'copy', label: '📋 Salin (Copy)',     desc: 'File tetap di sumber'     },
              ].map(opt => {
                const active = form.action === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField('action', opt.value)}
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
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Auto-create folder */}
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
              <span style={{ fontSize: 13, fontWeight: 500 }}>Buat folder tujuan otomatis</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                Jika folder tujuan belum ada, buat secara otomatis
              </span>
            </label>
          </div>

          {/* Active toggle */}
          <div style={{
            padding:      '12px 14px',
            background:   'var(--bg-elevated)',
            borderRadius: 'var(--radius)',
            border:       '1px solid var(--border-subtle)',
          }}>
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

      {/* Footer actions */}
      <div style={{
        padding:      '14px 24px',
        borderTop:    '1px solid var(--border-subtle)',
        display:      'flex',
        gap:          8,
        flexShrink:   0,
        background:   'var(--bg-surface)',
      }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            flex:         1,
            padding:      '9px 0',
            borderRadius: 'var(--radius)',
            border:       '1px solid var(--border-default)',
            background:   'transparent',
            color:        'var(--text-secondary)',
            fontSize:     13,
            fontWeight:   500,
            cursor:       saving ? 'not-allowed' : 'pointer',
            fontFamily:   'DM Sans, sans-serif',
          }}
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            flex:         2,
            padding:      '9px 0',
            borderRadius: 'var(--radius)',
            border:       'none',
            background:   saving ? 'var(--accent-muted)' : 'var(--accent)',
            color:        saving ? 'var(--accent)' : '#fff',
            fontSize:     13,
            fontWeight:   600,
            cursor:       saving ? 'not-allowed' : 'pointer',
            fontFamily:   'DM Sans, sans-serif',
            transition:   'background 0.15s',
          }}
        >
          {saving ? 'Menyimpan...' : rule ? '✓ Simpan Perubahan' : '+ Simpan Aturan'}
        </button>
      </div>
    </div>
  )
}