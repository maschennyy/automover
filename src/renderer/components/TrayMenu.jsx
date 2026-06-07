import { useState, useEffect } from 'react'
import useAppStore from '../store/useAppStore'

function SettingToggle({ label, description, value, onChange, disabled = false }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 16, opacity: disabled ? 0.45 : 1, transition: 'opacity 0.2s' }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>{description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>}</div><button type="button" disabled={disabled} onClick={() => !disabled && onChange(!value)} style={{ width: 40, height: 22, borderRadius: 99, border: '1px solid var(--border-default)', background: value ? 'var(--accent)' : 'var(--bg-overlay)', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s', flexShrink: 0 }}><span style={{ position: 'absolute', top: 2, left: value ? 19 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} /></button></div>
}

function Section({ title, children }) {
  return <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2 }}>{title}</div><div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>{children}</div></div>
}

function Divider() { return <div style={{ height: 1, background: 'var(--border-subtle)' }} /> }

function InfoRow({ label, value, action, onAction }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 12 }}><div><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>{value && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{value}</div>}</div>{action && <button type="button" onClick={onAction} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0, whiteSpace: 'nowrap' }}>{action}</button>}</div>
}

function ThemeOption({ label, description, value, current, onClick, disabled }) {
  const active = current === value
  return <button type="button" disabled={disabled} onClick={() => onClick(value)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 20px', border: 'none', borderBottom: '1px solid var(--border-subtle)', background: active ? 'var(--accent-muted)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', textAlign: 'left' }}><div><div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div><div style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{description}</div></div><span style={{ width: 18, height: 18, borderRadius: 99, border: active ? '5px solid var(--accent)' : '1px solid var(--border-default)', background: active ? '#fff' : 'transparent', flexShrink: 0 }} /></button>
}

export default function TrayMenu() {
  const { settings, updateSettings, setTheme, addToast } = useAppStore()
  const [appVersion, setAppVersion] = useState('—')
  const [configPath, setConfigPath] = useState('—')
  const [saveBusy, setSaveBusy] = useState(false)

  useEffect(() => {
    if (!window.automover?.app) return
    window.automover.app.getVersion().then(v => setAppVersion(v)).catch(() => {})
    window.automover.app.getConfigPath().then(p => setConfigPath(p)).catch(() => {})
  }, [])

  const applySetting = async (key, value) => {
    setSaveBusy(true)
    try {
      await updateSettings({ [key]: value })
      if (key === 'runAtStartup' && window.automover?.app) await window.automover.app.setLoginItem(value)
    } catch (err) {
      addToast('error', `Gagal menyimpan pengaturan: ${err.message}`)
    } finally {
      setSaveBusy(false)
    }
  }

  const applyTheme = async (theme) => {
    setSaveBusy(true)
    try {
      await setTheme(theme)
    } catch (err) {
      addToast('error', `Gagal mengganti tema: ${err.message}`)
    } finally {
      setSaveBusy(false)
    }
  }

  const openConfigFile = async () => {
    try { await window.automover.app.openConfigFile() }
    catch { addToast('error', 'Tidak bisa membuka file konfigurasi') }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease' }}>
      <div><h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, margin: 0 }}>Pengaturan</h1><p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>Konfigurasi perilaku aplikasi</p></div>

      <Section title="Tampilan">
        <ThemeOption label="Dark Mode" description="Tampilan gelap untuk penggunaan malam atau low-light." value="dark" current={settings.theme || 'dark'} onClick={applyTheme} disabled={saveBusy} />
        <ThemeOption label="Light Mode" description="Tampilan terang seperti aplikasi produktivitas umum." value="light" current={settings.theme || 'dark'} onClick={applyTheme} disabled={saveBusy} />
      </Section>

      <Section title="Monitoring"><SettingToggle label="Auto-Monitor" description="Pantau folder secara otomatis di latar belakang saat aplikasi berjalan" value={settings.autoMonitor ?? false} onChange={v => applySetting('autoMonitor', v)} disabled={saveBusy} /></Section>

      <Section title="Notifikasi"><SettingToggle label="Tampilkan notifikasi sistem" description="Tampilkan notifikasi di pojok layar saat file berhasil diproses" value={settings.showNotifications ?? true} onChange={v => applySetting('showNotifications', v)} disabled={saveBusy} /></Section>

      <Section title="Perilaku Jendela"><SettingToggle label="Sembunyikan ke system tray saat ditutup" description="Saat tombol ✕ diklik, aplikasi tetap berjalan di tray" value={settings.minimizeToTray ?? true} onChange={v => applySetting('minimizeToTray', v)} disabled={saveBusy} /><Divider /><SettingToggle label="Jalankan saat komputer dinyalakan" description="AutoMover otomatis berjalan saat OS startup" value={settings.runAtStartup ?? false} onChange={v => applySetting('runAtStartup', v)} disabled={saveBusy} /></Section>

      <Section title="Tentang"><InfoRow label="Versi" value={`AutoMover v${appVersion}`} /><Divider /><InfoRow label="File Konfigurasi" value={configPath !== '—' ? configPath : undefined} action="Buka" onAction={openConfigFile} /><Divider /><InfoRow label="Reset Onboarding" value="Tampilkan layar selamat datang lagi" action="Reset" onAction={() => applySetting('onboardingComplete', false)} /></Section>
      <div style={{ height: 12 }} />
    </div>
  )
}
