import { v4 as uuidv4 } from 'uuid'

function SelectControl({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange} style={{ minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 7, padding: '7px 8px', fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>
      {children}
    </select>
  )
}

function SmallButton({ children, onClick, disabled, primary = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding: '8px 10px', border: primary ? 'none' : '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : primary ? 'var(--accent)' : 'var(--bg-surface)', color: disabled ? 'var(--text-muted)' : primary ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}

function exportRulesJson(rules) {
  const data = { app: 'AutoMover', version: 1, exportedAt: new Date().toISOString(), rules }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const link = document.createElement('a')
  link.href = url
  link.download = `automover-rules-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function normalizeImportedRules(payload) {
  const source = Array.isArray(payload) ? payload : Array.isArray(payload?.rules) ? payload.rules : []
  return source
    .filter(rule => rule && typeof rule === 'object' && rule.watchFolder)
    .map(rule => ({
      ...rule,
      id: uuidv4(),
      name: rule.name || 'Imported Rule',
      filters: {
        extensions: Array.isArray(rule.filters?.extensions) ? rule.filters.extensions : [],
        namePattern: rule.filters?.namePattern || '',
      },
      action: rule.action === 'copy' ? 'copy' : 'move',
      destination: rule.destination || '',
      organizeBy: rule.organizeBy || 'extension',
      destinationBase: rule.destinationBase || 'custom',
      conflictStrategy: rule.conflictStrategy || 'rename',
      duplicateStrategy: rule.duplicateStrategy || 'none',
      priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 100,
      autoCreateFolder: rule.autoCreateFolder !== false,
      isActive: rule.isActive !== false,
    }))
}

export function matchesRuleToolbarFilters(rule, filters) {
  const q = filters.search.trim().toLowerCase()
  const searchOk = !q || [rule.name, rule.watchFolder, rule.destination, rule.action, rule.organizeBy, rule.filters?.namePattern, ...(rule.filters?.extensions || [])]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(q))
  const statusOk = filters.status === 'all' || (filters.status === 'active' ? rule.isActive : !rule.isActive)
  const actionOk = filters.action === 'all' || rule.action === filters.action
  return searchOk && statusOk && actionOk
}

export default function RuleToolbar({ rules, shownCount, activeCount, filters, setFilters, onAddNew, onImportRules }) {
  const hasFilter = Boolean(filters.search || filters.status !== 'all' || filters.action !== 'all')
  const clearFilters = () => setFilters({ search: '', status: 'all', action: 'all' })

  const importRules = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const imported = normalizeImportedRules(JSON.parse(text))
    if (!imported.length) throw new Error('No valid rules found')
    await onImportRules(imported)
  }

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, color: 'var(--text-muted)', fontSize: 12 }}>{shownCount} shown · {rules.length} total · {activeCount} active</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <SmallButton onClick={() => exportRulesJson(rules)} disabled={!rules.length}>Export</SmallButton>
          <label style={{ padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Import
            <input type="file" accept="application/json,.json" onChange={importRules} style={{ display: 'none' }} />
          </label>
          <SmallButton onClick={onAddNew} primary>+ New</SmallButton>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 120px 110px auto', gap: 8, alignItems: 'center' }}>
        <input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Search rules..." style={{ minWidth: 0, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', padding: '8px 10px', fontSize: 12, outline: 'none' }} />
        <SelectControl value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectControl>
        <SelectControl value={filters.action} onChange={event => setFilters({ ...filters, action: event.target.value })}>
          <option value="all">All action</option>
          <option value="move">Move</option>
          <option value="copy">Copy</option>
        </SelectControl>
        <SmallButton onClick={clearFilters} disabled={!hasFilter}>Clear</SmallButton>
      </div>
    </div>
  )
}
