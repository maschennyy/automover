import { useState } from 'react'
import useAppStore from '../store/useAppStore'

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconEdit  = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)
const IconFolder = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconArrow = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function truncatePath(path, max = 38) {
  if (!path || path.length <= max) return path
  const parts = path.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return '...' + path.slice(-max)
  // Show drive + last segment
  return parts[0] + '/.../' + parts[parts.length - 1]
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────
function ConfirmModal({ ruleName, onConfirm, onCancel }) {
  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         200,
      background:     'rgba(0,0,0,0.6)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background:   'var(--bg-elevated)',
        border:       '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding:      '24px 28px',
        width:        340,
        boxShadow:    '0 20px 60px rgba(0,0,0,0.5)',
        animation:    'fadeIn 0.15s ease',
      }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          Hapus Aturan?
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          Aturan <strong style={{ color: 'var(--text-primary)' }}>"{ruleName || 'Tanpa Nama'}"</strong> akan dihapus permanen.
          File yang sudah dipindahkan tidak terpengaruh.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--radius)',
              border: '1px solid var(--border-default)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >Batal</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--radius)',
              border: 'none', background: 'var(--danger)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >Hapus</button>
        </div>
      </div>
    </div>
  )
}

// ─── Rule Card ────────────────────────────────────────────────────────────────
function RuleCard({ rule, onEdit, onDelete }) {
  const { toggleRule } = useAppStore()
  const [hovered, setHovered] = useState(false)

  const handleToggle = async () => {
    await toggleRule(rule.id)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border:        `1px solid ${rule.isActive ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius:  'var(--radius-lg)',
        padding:       '14px 16px',
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
        opacity:       rule.isActive ? 1 : 0.55,
        transition:    'background 0.15s, border-color 0.15s, opacity 0.2s',
        position:      'relative',
      }}
    >
      {/* Top row: name + badges + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Active indicator dot */}
        <span style={{
          width:        7,
          height:       7,
          borderRadius: '50%',
          background:   rule.isActive ? 'var(--success)' : 'var(--text-muted)',
          flexShrink:   0,
          boxShadow:    rule.isActive ? '0 0 5px var(--success)' : 'none',
          transition:   'background 0.2s',
        }} />

        {/* Rule name */}
        <span style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize:   14,
          flex:       1,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {rule.name || 'Tanpa Nama'}
        </span>

        {/* Action badge */}
        <span style={{
          fontSize:     10,
          fontWeight:   700,
          padding:      '2px 7px',
          borderRadius: 4,
          background:   rule.action === 'move' ? '#3b82f622' : '#22c55e22',
          color:        rule.action === 'move' ? '#60a5fa'   : '#4ade80',
          border:       `1px solid ${rule.action === 'move' ? '#3b82f644' : '#22c55e44'}`,
          letterSpacing: '0.05em',
          fontFamily:   'DM Sans, sans-serif',
          flexShrink:   0,
        }}>
          {rule.action === 'move' ? 'PINDAH' : 'SALIN'}
        </span>

        {/* Toggle */}
        <button
          type="button"
          onClick={handleToggle}
          title={rule.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          style={{
            width:        36,
            height:       20,
            borderRadius: 99,
            border:       '1px solid var(--border-default)',
            background:   rule.isActive ? 'var(--accent)' : 'var(--bg-overlay)',
            position:     'relative',
            cursor:       'pointer',
            transition:   'background 0.2s',
            flexShrink:   0,
          }}
        >
          <span style={{
            position:     'absolute',
            top:          2,
            left:         rule.isActive ? 17 : 2,
            width:        14,
            height:       14,
            borderRadius: '50%',
            background:   '#fff',
            transition:   'left 0.18s',
          }} />
        </button>

        {/* Edit btn */}
        <button
          type="button"
          onClick={() => onEdit(rule)}
          title="Edit aturan"
          style={{
            background:   'none',
            border:       '1px solid var(--border-default)',
            borderRadius: 6,
            color:        'var(--text-secondary)',
            cursor:       'pointer',
            padding:      '4px 6px',
            display:      'flex',
            alignItems:   'center',
            transition:   'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <IconEdit />
        </button>

        {/* Delete btn */}
        <button
          type="button"
          onClick={() => onDelete(rule)}
          title="Hapus aturan"
          style={{
            background:   'none',
            border:       '1px solid var(--border-default)',
            borderRadius: 6,
            color:        'var(--text-secondary)',
            cursor:       'pointer',
            padding:      '4px 6px',
            display:      'flex',
            alignItems:   'center',
            transition:   'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ef444422'; e.currentTarget.style.color = 'var(--danger)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <IconTrash />
        </button>
      </div>

      {/* Path row: watchFolder → destination */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        6,
        fontSize:   11,
        color:      'var(--text-muted)',
        fontFamily: 'JetBrains Mono, monospace',
        background: 'var(--bg-overlay)',
        padding:    '6px 10px',
        borderRadius: 6,
        overflow:   'hidden',
      }}>
        <IconFolder />
        <span
          title={rule.watchFolder}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
        >
          {truncatePath(rule.watchFolder)}
        </span>
        <span style={{ flexShrink: 0, color: 'var(--accent)', opacity: 0.8 }}>
          <IconArrow />
        </span>
        <IconFolder />
        <span
          title={rule.destination}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
        >
          {truncatePath(rule.destination)}
        </span>
      </div>

      {/* Filter chips row */}
      {(rule.filters?.extensions?.length > 0 || rule.filters?.namePattern) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {rule.filters.extensions.map(ext => (
            <span key={ext} style={{
              fontSize:     10,
              fontWeight:   600,
              fontFamily:   'JetBrains Mono, monospace',
              background:   'var(--accent-muted)',
              color:        'var(--accent)',
              border:       '1px solid var(--accent-border)',
              borderRadius: 4,
              padding:      '1px 6px',
            }}>
              {ext}
            </span>
          ))}
          {rule.filters.namePattern && (
            <span style={{
              fontSize:     10,
              fontFamily:   'JetBrains Mono, monospace',
              background:   '#f59e0b18',
              color:        '#f59e0b',
              border:       '1px solid #f59e0b33',
              borderRadius: 4,
              padding:      '1px 6px',
            }}>
              {rule.filters.namePattern}
            </span>
          )}
        </div>
      )}

      {/* No filters warning */}
      {(!rule.filters?.extensions?.length && !rule.filters?.namePattern) && (
        <div style={{ fontSize: 10, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠️ Semua file akan diproses (tidak ada filter)
        </div>
      )}
    </div>
  )
}

// ─── RuleList ─────────────────────────────────────────────────────────────────
/**
 * Props:
 *   onAddNew  : () => void      — buka RuleBuilder dalam mode create
 *   onEdit    : (rule) => void  — buka RuleBuilder dalam mode edit
 */
export default function RuleList({ onAddNew, onEdit }) {
  const { rules, deleteRule } = useAppStore()
  const [confirmRule, setConfirmRule] = useState(null)

  const handleDeleteConfirm = async () => {
    if (!confirmRule) return
    await deleteRule(confirmRule.id)
    setConfirmRule(null)
  }

  return (
    <div style={{
      flex:          1,
      display:       'flex',
      flexDirection: 'column',
      overflow:      'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:        '20px 24px 14px',
        borderBottom:   '1px solid var(--border-subtle)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexShrink:     0,
      }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, margin: 0 }}>
            Aturan Sortir
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>
            {rules.length === 0
              ? 'Belum ada aturan'
              : `${rules.length} aturan · ${rules.filter(r => r.isActive).length} aktif`}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddNew}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            background:   'var(--accent)',
            border:       'none',
            borderRadius: 'var(--radius)',
            color:        '#fff',
            fontSize:     13,
            fontWeight:   600,
            padding:      '8px 14px',
            cursor:       'pointer',
            fontFamily:   'DM Sans, sans-serif',
            transition:   'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
        >
          <IconPlus /> Tambah Aturan
        </button>
      </div>

      {/* List */}
      <div style={{
        flex:      1,
        overflowY: 'auto',
        padding:   '16px 24px',
      }}>
        {rules.length === 0 ? (
          /* Empty state */
          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            height:         '100%',
            gap:            14,
            color:          'var(--text-muted)',
            paddingBottom:  60,
            animation:      'fadeIn 0.3s ease',
          }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>📂</div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Belum ada aturan
              </p>
              <p style={{ fontSize: 12, marginTop: 4 }}>
                Klik "+ Tambah Aturan" untuk membuat aturan sortir pertama
              </p>
            </div>
            <button
              type="button"
              onClick={onAddNew}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                background:   'var(--accent-muted)',
                border:       '1px dashed var(--accent-border)',
                borderRadius: 'var(--radius)',
                color:        'var(--accent)',
                fontSize:     13,
                fontWeight:   600,
                padding:      '9px 18px',
                cursor:       'pointer',
                fontFamily:   'DM Sans, sans-serif',
                marginTop:    4,
              }}
            >
              <IconPlus /> Buat Aturan Pertama
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn 0.2s ease' }}>
            {rules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={onEdit}
                onDelete={(r) => setConfirmRule(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmRule && (
        <ConfirmModal
          ruleName={confirmRule.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmRule(null)}
        />
      )}
    </div>
  )
}