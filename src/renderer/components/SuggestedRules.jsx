import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import useAppStore from '../store/useAppStore'

function getKeyword(fileName) {
  const base = String(fileName || '').split('.')[0] || ''
  const parts = base.split('-').join('_').split(' ').join('_').split('_')
  const token = parts.find(part => part.length >= 3 && /[A-Za-z]/.test(part))
  return token ? token.toUpperCase() : ''
}

function buildSuggestions(logs, rules) {
  const existing = new Set(rules.map(rule => String(rule.filters?.namePattern || '').toUpperCase()).filter(Boolean))
  const map = new Map()

  for (const log of logs) {
    if (!log || log.undone || log.action === 'skip') continue
    const keyword = getKeyword(log.fileName)
    if (!keyword || existing.has(keyword)) continue
    if (!map.has(keyword)) map.set(keyword, { keyword, count: 0, examples: [] })
    const item = map.get(keyword)
    item.count += 1
    if (item.examples.length < 3) item.examples.push(log.fileName)
  }

  return Array.from(map.values())
    .filter(item => item.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

function Button({ children, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding: '8px 10px', border: 'none', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg-overlay)' : 'var(--accent)', color: disabled ? 'var(--text-muted)' : '#fff', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </button>
  )
}

function Pill({ children }) {
  return <span style={{ padding: '4px 8px', borderRadius: 99, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-border)', fontSize: 11, fontWeight: 800 }}>{children}</span>
}

export default function SuggestedRules({ compact = false }) {
  const { logs, rules, addRule } = useAppStore()
  const [busyKey, setBusyKey] = useState('')
  const [notice, setNotice] = useState('')
  const suggestions = useMemo(() => buildSuggestions(logs, rules), [logs, rules])

  const createSuggestion = async (suggestion) => {
    setBusyKey(suggestion.keyword)
    setNotice('')
    try {
      const sample = logs.find(log => String(log.fileName || '').toUpperCase().includes(suggestion.keyword))
      const from = String(sample?.from || '')
      const slash = Math.max(from.lastIndexOf('/'), from.lastIndexOf('\\'))
      const watchFolder = slash >= 0 ? from.slice(0, slash) : ''
      const rule = {
        id: uuidv4(),
        name: `Suggested ${suggestion.keyword}`,
        watchFolder,
        filters: { extensions: [], namePattern: suggestion.keyword },
        action: 'move',
        destination: '',
        organizeBy: 'name',
        destinationBase: 'source',
        conflictStrategy: 'rename',
        duplicateStrategy: 'skip-same-name-size',
        priority: 50,
        autoCreateFolder: true,
        isActive: true,
      }
      const result = await addRule(rule)
      if (!result?.success) throw new Error(result?.error || 'Failed to create rule')
      setNotice(`Rule ${suggestion.keyword} created.`)
    } catch (err) {
      setNotice(`Failed: ${err.message}`)
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800 }}>Suggested Rules</div>
          {!compact && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>Auto learning from activity logs.</div>}
        </div>
        <Pill>{suggestions.length} found</Pill>
      </div>

      {notice && <div style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-overlay)', color: notice.startsWith('Failed') ? '#f87171' : '#4ade80', fontSize: 12 }}>{notice}</div>}

      {suggestions.length === 0 ? (
        <div style={{ padding: 18, borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)', color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
          No suggestions yet. Run rules first.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {suggestions.map(item => (
            <div key={item.keyword} style={{ padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>{item.keyword}</div>
                <Pill>{item.count}x</Pill>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{item.examples.join(', ')}</div>
              <Button onClick={() => createSuggestion(item)} disabled={busyKey === item.keyword}>{busyKey === item.keyword ? 'Creating...' : 'Create Rule'}</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
