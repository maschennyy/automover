import { useState } from 'react'
import useAppStore from '../store/useAppStore'

const IconEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
const IconTrash = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
const IconPlus = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>

function truncatePath(value, max = 44) {
  if (!value) return '-'
  if (value.length <= max) return value
  const parts = value.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return '...' + value.slice(-max)
  return `${parts[0]}/.../${parts[parts.length - 1]}`
}

function modeLabel(rule) {
  const mode = rule.organizeBy || 'extension'
  if (mode === 'category') return 'Category'
  if (mode === 'extension') return 'Extension'
  if (mode === 'name') return 'Name'
  if (mode === 'none') return 'Fixed'
  return mode
}

function conflictLabel(value) {
  if (value === 'skip') return 'Skip'
  if (value === 'overwrite') return 'Overwrite'
  return 'Rename'
}

function duplicateLabel(value) {
  if (value === 'skip-same-name-size') return 'Skip duplicate'
  return 'Off'
}

function ConfirmModal({ ruleName, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 22, width: 'min(340px, 100%)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, margin: '0 0 8px' }}>Hapus rule?</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 18px' }}><strong style={{ color: 'var(--text-primary)' }}>{ruleName || 'Tanpa Nama'}</strong> akan dihapus.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Batal</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Hapus</button>
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
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 6, background: palette[0], color: palette[1], border: `1px solid ${palette[2]}`, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{children}</span>
}

function SelectControl({ value, onChange, children, title }) {
  return <select value={value} onChange={onChange} title={title} style={{ minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 7, padding: '6px 8px', fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>{children}</select>
}

function MiniLabel({ children }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{children}</div>
}

function RuleCard({ rule, onEdit, onDelete }) {
  const { toggleRule, updateRule } = useAppStore()
  const [hovered, setHovered] = useState(false)
  const conflict = rule.conflictStrategy || 'rename'
  const duplicate = rule.duplicateStrategy || 'none'
  const priority = Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 100
  const updatePartial = async (partial) => updateRule({ ...rule, ...partial })

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)', border: `1px solid ${rule.isActive ? 'var(--border-default)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-lg)', padding: 13, display: 'flex', flexDirection: 'column', gap: 10, opacity: rule.isActive ? 1 : 0.55, transition: 'background .15s, border-color .15s, opacity .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: rule.isActive ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0, boxShadow: rule.isActive ? '0 0 5px var(--success)' : 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div title={rule.name || 'Tanpa Nama'} style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name || 'Tanpa Nama'}</div>
          <div title={rule.watchFolder} style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncatePath(rule.watchFolder, 58)}</div>
        </div>
        <Chip tone="neutral">P{priority}</Chip>
        <Chip tone={rule.action === 'move' ? 'blue' : 'green'}>{rule.action === 'move' ? 'Move' : 'Copy'}</Chip>
        <button type="button" onClick={() => toggleRule(rule.id)} title={rule.isActive ? 'Disable' : 'Enable'} style={{ width: 34, height: 20, borderRadius: 99, border: '1px solid var(--border-default)', background: rule.isActive ? 'var(--accent)' : 'var(--bg-overlay)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}><span style={{ position: 'absolute', top: 2, left: rule.isActive ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .18s' }} /></button>
        <button type="button" onClick={() => onEdit(rule)} title="Edit" style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}><IconEdit /></button>
        <button type="button" onClick={() => onDelete(rule)} title="Delete" style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}><IconTrash /></button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Chip tone="neutral">{modeLabel(rule)}</Chip>
        <Chip tone={conflict === 'overwrite' ? 'red' : conflict === 'skip' ? 'amber' : 'accent'}>{conflictLabel(conflict)}</Chip>
        <Chip tone={duplicate === 'skip-same-name-size' ? 'amber' : 'neutral'}>{duplicateLabel(duplicate)}</Chip>
        {rule.filters?.extensions?.slice(0, 6).map(ext => <Chip key={ext}>{ext}</Chip>)}
        {(rule.filters?.extensions?.length || 0) > 6 && <Chip tone="neutral">+{rule.filters.extensions.length - 6}</Chip>}
        {rule.filters?.namePattern && <Chip tone="amber" title={rule.filters.namePattern}>Name filter</Chip>}
        {(!rule.filters?.extensions?.length && !rule.filters?.namePattern) && <Chip tone="amber">All files</Chip>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '84px minmax(130px, 1fr) minmax(140px, 1fr)', gap: 8, alignItems: 'end' }}>
        <div>
          <MiniLabel>Priority</MiniLabel>
          <input type="number" min="1" max="999" value={priority} onChange={e => updatePartial({ priority: Number(e.target.value || 100) })} title="Lower number runs first" style={{ width: '100%', background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 7, padding: '6px 8px', fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
        </div>
        <div>
          <MiniLabel>Conflict</MiniLabel>
          <SelectControl value={conflict} onChange={e => updatePartial({ conflictStrategy: e.target.value })} title="Conflict strategy"><option value="rename">Rename</option><option value="skip">Skip</option><option value="overwrite">Overwrite</option></SelectControl>
        </div>
        <div>
          <MiniLabel>Duplicate</MiniLabel>
          <SelectControl value={duplicate} onChange={e => updatePartial({ duplicateStrategy: e.target.value })} title="Duplicate detection"><option value="none">Off</option><option value="skip-same-name-size">Skip same name+size</option></SelectControl>
        </div>
      </div>
    </div>
  )
}

export default function RuleList({ onAddNew, onEdit }) {
  const { rules, deleteRule } = useAppStore()
  const [confirmRule, setConfirmRule] = useState(null)
  const sortedRules = [...rules].sort((a, b) => (Number(a.priority) || 100) - (Number(b.priority) || 100))
  const activeCount = rules.filter(r => r.isActive).length

  const handleDeleteConfirm = async () => {
    if (!confirmRule) return
    await deleteRule(confirmRule.id)
    setConfirmRule(null)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}><h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, margin: 0 }}>Rules</h1><p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '3px 0 0' }}>{rules.length} total · {activeCount} active</p></div>
        <button type="button" onClick={onAddNew} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 13, fontWeight: 800, padding: '8px 12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}><IconPlus /> New</button>
      </div>

      <div className="panel-scroll" style={{ flex: 1, padding: 14 }}>
        {rules.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}><div><div style={{ fontSize: 42 }}>📂</div><p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)' }}>No rules yet</p><button type="button" onClick={onAddNew} style={{ background: 'var(--accent-muted)', border: '1px dashed var(--accent-border)', borderRadius: 'var(--radius)', color: 'var(--accent)', fontSize: 13, fontWeight: 800, padding: '9px 16px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}><IconPlus /> Create rule</button></div></div>
        ) : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{sortedRules.map(rule => <RuleCard key={rule.id} rule={rule} onEdit={onEdit} onDelete={setConfirmRule} />)}</div>}
      </div>
      {confirmRule && <ConfirmModal ruleName={confirmRule.name} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmRule(null)} />}
    </div>
  )
}
