import { useState } from 'react'
import useAppStore from '../store/useAppStore'

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
)

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

function truncatePath(value, max = 42) {
  if (!value) return '-'
  if (value.length <= max) return value
  const parts = value.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return '...' + value.slice(-max)
  return `${parts[0]}/.../${parts[parts.length - 1]}`
}

function modeLabel(rule) {
  const mode = rule.organizeBy || 'extension'
  if (mode === 'category') return 'Smart Category'
  if (mode === 'extension') return 'By Extension'
  if (mode === 'name') return 'By Name'
  if (mode === 'none') return 'Fixed Folder'
  return mode
}

function conflictLabel(value) {
  if (value === 'skip') return 'Skip'
  if (value === 'overwrite') return 'Overwrite'
  return 'Rename'
}

function ConfirmModal({ ruleName, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Hapus Aturan?</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
          Aturan <strong style={{ color: 'var(--text-primary)' }}>"{ruleName || 'Tanpa Nama'}"</strong> akan dihapus permanen. File yang sudah dipindahkan tidak terpengaruh.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Batal</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Hapus</button>
        </div>
      </div>
    </div>
  )
}

function Chip({ children, tone = 'accent' }) {
  const palette = {
    accent: ['var(--accent-muted)', 'var(--accent)', 'var(--accent-border)'],
    blue: ['#3b82f622', '#60a5fa', '#3b82f644'],
    green: ['#22c55e22', '#4ade80', '#22c55e44'],
    amber: ['#f59e0b18', '#f59e0b', '#f59e0b33'],
    red: ['#ef444418', '#f87171', '#ef444444'],
    neutral: ['var(--bg-overlay)', 'var(--text-muted)', 'var(--border-default)'],
  }[tone]
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: palette[0], color: palette[1], border: `1px solid ${palette[2]}`, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function RuleCard({ rule, onEdit, onDelete }) {
  const { toggleRule, updateRule } = useAppStore()
  const [hovered, setHovered] = useState(false)
  const conflict = rule.conflictStrategy || 'rename'

  const handleConflictChange = async (event) => {
    const nextValue = event.target.value
    await updateRule({ ...rule, conflictStrategy: nextValue })
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: `1px solid ${rule.isActive ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
        opacity: rule.isActive ? 1 : 0.55,
        transition: 'background 0.15s, border-color 0.15s, opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: rule.isActive ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0, boxShadow: rule.isActive ? '0 0 5px var(--success)' : 'none' }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name || 'Tanpa Nama'}</span>
        <Chip tone={rule.action === 'move' ? 'blue' : 'green'}>{rule.action === 'move' ? 'PINDAH' : 'SALIN'}</Chip>
        <button type="button" onClick={() => toggleRule(rule.id)} title={rule.isActive ? 'Nonaktifkan' : 'Aktifkan'} style={{ width: 36, height: 20, borderRadius: 99, border: '1px solid var(--border-default)', background: rule.isActive ? 'var(--accent)' : 'var(--bg-overlay)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: rule.isActive ? 17 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.18s' }} />
        </button>
        <button type="button" onClick={() => onEdit(rule)} title="Edit aturan" style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}><IconEdit /></button>
        <button type="button" onClick={() => onDelete(rule)} title="Hapus aturan" style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}><IconTrash /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', background: 'var(--bg-overlay)', padding: '7px 10px', borderRadius: 6, overflow: 'hidden' }}>
        <span title={rule.watchFolder} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncatePath(rule.watchFolder)}</span>
        <span>→</span>
        <span title={rule.destination || 'Folder sumber'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.destinationBase === 'source' ? 'Folder sumber' : truncatePath(rule.destination)}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Chip tone="neutral">{modeLabel(rule)}</Chip>
        <Chip tone={conflict === 'overwrite' ? 'red' : conflict === 'skip' ? 'amber' : 'accent'}>Conflict: {conflictLabel(conflict)}</Chip>
        {rule.filters?.extensions?.map(ext => <Chip key={ext}>{ext}</Chip>)}
        {rule.filters?.namePattern && <Chip tone="amber">{rule.filters.namePattern}</Chip>}
        {(!rule.filters?.extensions?.length && !rule.filters?.namePattern) && <Chip tone="amber">Semua file</Chip>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Jika nama sama</label>
        <select
          value={conflict}
          onChange={handleConflictChange}
          title="Conflict strategy"
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 7, padding: '6px 9px', fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
        >
          <option value="rename">Rename otomatis</option>
          <option value="skip">Skip</option>
          <option value="overwrite">Overwrite</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {conflict === 'rename' && 'file baru diberi suffix _1, _2, dst.'}
          {conflict === 'skip' && 'file bentrok dilewati.'}
          {conflict === 'overwrite' && 'file lama di tujuan akan ditimpa.'}
        </span>
      </div>
    </div>
  )
}

export default function RuleList({ onAddNew, onEdit }) {
  const { rules, deleteRule } = useAppStore()
  const [confirmRule, setConfirmRule] = useState(null)

  const handleDeleteConfirm = async () => {
    if (!confirmRule) return
    await deleteRule(confirmRule.id)
    setConfirmRule(null)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, margin: 0 }}>Aturan Sortir</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>{rules.length === 0 ? 'Belum ada aturan' : `${rules.length} aturan · ${rules.filter(r => r.isActive).length} aktif`}</p>
        </div>
        <button type="button" onClick={onAddNew} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          <IconPlus /> Tambah Aturan
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {rules.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, color: 'var(--text-muted)', paddingBottom: 60 }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>📂</div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Belum ada aturan</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Klik "+ Tambah Aturan" untuk membuat aturan sortir pertama</p>
            </div>
            <button type="button" onClick={onAddNew} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-muted)', border: '1px dashed var(--accent-border)', borderRadius: 'var(--radius)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, padding: '9px 18px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>
              <IconPlus /> Buat Aturan Pertama
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map(rule => <RuleCard key={rule.id} rule={rule} onEdit={onEdit} onDelete={setConfirmRule} />)}
          </div>
        )}
      </div>

      {confirmRule && <ConfirmModal ruleName={confirmRule.name} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmRule(null)} />}
    </div>
  )
}
