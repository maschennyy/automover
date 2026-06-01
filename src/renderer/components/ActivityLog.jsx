import { useState, useMemo, useCallback } from 'react'
import useAppStore from '../store/useAppStore'

// ─── Timestamp formatter ──────────────────────────────────────────────────────

/**
 * Format ISO8601 → "14:35:22 · 30/05/2025"
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  try {
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const DD = String(d.getDate()).padStart(2, '0')
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const YY = d.getFullYear()
    return `${hh}:${mm}:${ss} · ${DD}/${MM}/${YY}`
  } catch {
    return iso
  }
}

/**
 * Shorten a filesystem path for display.
 * "C:/Users/Name/Documents/Tagihan" → "C:/…/Tagihan"
 * @param {string} p
 * @param {number} max
 * @returns {string}
 */
function truncatePath(p, max = 36) {
  if (!p || p.length <= max) return p
  const parts = p.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return '…' + p.slice(-(max - 1))
  return parts[0] + '/…/' + parts[parts.length - 1]
}

// ─── Inline icons ─────────────────────────────────────────────────────────────
const IconUndo  = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconArrow = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE    = 50
const FILTER_TABS  = [
  { id: 'all',  label: 'Semua'  },
  { id: 'move', label: 'Pindah' },
  { id: 'copy', label: 'Salin'  },
]

// ─── Confirm Clear Modal ──────────────────────────────────────────────────────
function ConfirmClearModal({ onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', padding: '24px 28px', width: 340,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'fadeIn 0.15s ease',
      }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          Hapus Semua Log?
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          Seluruh riwayat operasi akan dihapus permanen. File yang sudah dipindahkan <strong>tidak</strong> terpengaruh.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '8px 0', borderRadius: 'var(--radius)',
            border: '1px solid var(--border-default)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}>Batal</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '8px 0', borderRadius: 'var(--radius)',
            border: 'none', background: 'var(--danger)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}>Hapus Semua</button>
        </div>
      </div>
    </div>
  )
}

// ─── Log Row ──────────────────────────────────────────────────────────────────
function LogRow({ entry, isNew, onUndo }) {
  const [undoing, setUndoing] = useState(false)

  const handleUndo = async () => {
    setUndoing(true)
    try {
      await onUndo(entry)
    } finally {
      setUndoing(false)
    }
  }

  const isDone    = entry.undone
  const textStyle = isDone ? { textDecoration: 'line-through', opacity: 0.45 } : {}

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        opacity:      isDone ? 0.6 : 1,
        transition:   'opacity 0.3s',
        animation:    isNew ? 'slideIn 0.25s ease' : 'none',
        background:   'transparent',
      }}
      onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = 'var(--bg-elevated)' }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Timestamp */}
      <td style={{ padding: '9px 12px 9px 16px', whiteSpace: 'nowrap', fontSize: 11,
                   color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', ...textStyle }}>
        {formatTimestamp(entry.timestamp)}
      </td>

      {/* File name */}
      <td style={{ padding: '9px 12px', maxWidth: 160 }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)',
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                       display: 'block', ...textStyle }}
              title={entry.fileName}>
          {entry.fileName}
        </span>
      </td>

      {/* From → To */}
      <td style={{ padding: '9px 12px', maxWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', ...textStyle }}>
          <span title={entry.from}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
            {truncatePath(entry.from)}
          </span>
          <span style={{ flexShrink: 0, color: 'var(--accent)', opacity: 0.7 }}><IconArrow /></span>
          <span title={entry.to}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
            {truncatePath(entry.to)}
          </span>
        </div>
      </td>

      {/* Action badge */}
      <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: entry.action === 'move' ? '#3b82f622' : '#22c55e22',
          color:      entry.action === 'move' ? '#60a5fa'   : '#4ade80',
          border:     `1px solid ${entry.action === 'move' ? '#3b82f633' : '#22c55e33'}`,
          fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.04em',
          ...textStyle,
        }}>
          {entry.action === 'move' ? 'PINDAH' : 'SALIN'}
        </span>
      </td>

      {/* Status */}
      <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>
        {isDone ? (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            ↩ Di-undo
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
            ✓ Berhasil
          </span>
        )}
      </td>

      {/* Undo button */}
      <td style={{ padding: '9px 16px 9px 8px', whiteSpace: 'nowrap' }}>
        {!isDone ? (
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            title="Kembalikan file ke lokasi asal"
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          4,
              padding:      '4px 9px',
              borderRadius: 6,
              border:       '1px solid var(--border-default)',
              background:   'transparent',
              color:        undoing ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontSize:     11,
              fontWeight:   500,
              cursor:       undoing ? 'not-allowed' : 'pointer',
              fontFamily:   'DM Sans, sans-serif',
              transition:   'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { if (!undoing) { e.currentTarget.style.background = 'var(--accent-muted)'; e.currentTarget.style.color = 'var(--accent)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <IconUndo />
            {undoing ? 'Proses...' : 'Undo'}
          </button>
        ) : (
          <span style={{ width: 60, display: 'inline-block' }} />
        )}
      </td>
    </tr>
  )
}

// ─── ActivityLog ─────────────────────────────────────────────────────────────
export default function ActivityLog() {
  const { logs, markLogUndone, clearLogs, addToast } = useAppStore()

  // ── Filter + search state ───────────────────────────────────────────────────
  const [actionFilter, setActionFilter] = useState('all')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [page,         setPage]         = useState(1)
  const [showClear,    setShowClear]    = useState(false)

  // Track which ids are "new" (just arrived via watcher push) for animation
  const [newIds, setNewIds] = useState(() => new Set())

  // ── Filtered + searched list (memoised for perf with 500 entries) ───────────
  const filtered = useMemo(() => {
    let list = logs

    if (actionFilter !== 'all') {
      list = list.filter(l => l.action === actionFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(l => l.fileName.toLowerCase().includes(q))
    }

    return list
  }, [logs, actionFilter, searchQuery])

  // Reset to page 1 whenever filter/search changes
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // ── Undo handler ────────────────────────────────────────────────────────────
  const handleUndo = useCallback(async (entry) => {
    try {
      const result = await window.automover.fileOps.undo(entry)

      if (result.success) {
        await markLogUndone(entry.id)
        addToast('success', `↩ ${entry.fileName} dikembalikan ke lokasi asal`)
      } else {
        addToast('error', `Undo gagal: ${result.error}`)
      }
    } catch (err) {
      addToast('error', `Undo gagal: ${err.message}`)
    }
  }, [markLogUndone, addToast])

  // ── Clear logs handler ──────────────────────────────────────────────────────
  const handleClearConfirm = useCallback(async () => {
    setShowClear(false)
    await clearLogs()
    setPage(1)
    addToast('info', 'Semua log berhasil dihapus')
  }, [clearLogs, addToast])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        padding:        '18px 24px 12px',
        borderBottom:   '1px solid var(--border-subtle)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexShrink:     0,
        gap:            12,
      }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, margin: 0 }}>
            Riwayat Aktivitas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>
            {logs.length === 0
              ? 'Belum ada aktivitas'
              : `${logs.length} operasi · ${logs.filter(l => l.undone).length} di-undo`}
          </p>
        </div>

        {/* Clear all button */}
        {logs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClear(true)}
            style={{
              display:    'flex', alignItems: 'center', gap: 5,
              padding:    '6px 12px', borderRadius: 'var(--radius)',
              border:     '1px solid var(--border-default)', background: 'transparent',
              color:      'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', transition: 'color 0.15s, border-color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
          >
            <IconTrash /> Hapus Semua Log
          </button>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div style={{
        padding:      '10px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        flexShrink:   0,
        background:   'var(--bg-surface)',
      }}>
        {/* Action filter tabs */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-overlay)', padding: 2, borderRadius: 8 }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActionFilter(tab.id); setPage(1) }}
              style={{
                padding:      '4px 12px',
                borderRadius: 6,
                border:       'none',
                background:   actionFilter === tab.id ? 'var(--bg-elevated)' : 'transparent',
                color:        actionFilter === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize:     12,
                fontWeight:   actionFilter === tab.id ? 600 : 400,
                cursor:       'pointer',
                fontFamily:   'DM Sans, sans-serif',
                transition:   'background 0.15s',
              }}
            >
              {tab.label}
              {tab.id !== 'all' && (
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.6 }}>
                  ({logs.filter(l => l.action === tab.id).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          7,
          background:   'var(--bg-overlay)',
          border:       '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding:      '5px 10px',
          flex:         1,
          maxWidth:     260,
        }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><IconSearch /></span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Cari nama file..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 12,
              fontFamily: 'DM Sans, sans-serif', width: '100%',
              userSelect: 'text',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setPage(1) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
            >×</button>
          )}
        </div>

        {/* Results count */}
        {(actionFilter !== 'all' || searchQuery) && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filtered.length} hasil
          </span>
        )}
      </div>

      {/* ── Table or empty state ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            12,
          color:          'var(--text-muted)',
          paddingBottom:  40,
          animation:      'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: 44 }}>📋</div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {logs.length === 0 ? 'Belum ada aktivitas' : 'Tidak ada hasil yang cocok'}
            </p>
            <p style={{ fontSize: 12, marginTop: 4, maxWidth: 280 }}>
              {logs.length === 0
                ? 'AutoMover akan mencatat setiap operasi file di sini.'
                : 'Coba ubah filter atau kata kunci pencarian.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Scrollable table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{
              width:           '100%',
              borderCollapse:  'collapse',
              fontSize:        12,
            }}>
              {/* Table header */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}>
                  {['Waktu', 'File', 'Dari → Ke', 'Aksi', 'Status', ''].map((h, i) => (
                    <th key={i} style={{
                      padding:   '8px 12px 8px ' + (i === 0 ? '16px' : '12px'),
                      textAlign: 'left',
                      fontSize:  10,
                      fontWeight: 700,
                      color:     'var(--text-muted)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      whiteSpace:    'nowrap',
                      paddingRight:  i === 5 ? '16px' : '12px',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pageSlice.map(entry => (
                  <LogRow
                    key={entry.id}
                    entry={entry}
                    isNew={newIds.has(entry.id)}
                    onUndo={handleUndo}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '10px 24px',
              borderTop:      '1px solid var(--border-subtle)',
              flexShrink:     0,
              background:     'var(--bg-surface)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} dari {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
                    background: 'transparent', color: safePage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontSize: 12, cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif',
                  }}
                >← Sebelumnya</button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  // Show first, last, current ± 2 and ellipsis otherwise
                  const pg = i + 1
                  const show = pg === 1 || pg === totalPages || Math.abs(pg - safePage) <= 1
                  if (!show) return null
                  return (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setPage(pg)}
                      style={{
                        padding: '4px 8px', borderRadius: 6, border: '1px solid',
                        borderColor:  pg === safePage ? 'var(--accent)' : 'var(--border-default)',
                        background:   pg === safePage ? 'var(--accent-muted)' : 'transparent',
                        color:        pg === safePage ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', minWidth: 30,
                      }}
                    >{pg}</button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
                    background: 'transparent', color: safePage === totalPages ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontSize: 12, cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif',
                  }}
                >Berikutnya →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirm clear modal */}
      {showClear && (
        <ConfirmClearModal
          onConfirm={handleClearConfirm}
          onCancel={() => setShowClear(false)}
        />
      )}
    </div>
  )
}