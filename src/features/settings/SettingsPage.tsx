import type { ComponentChildren } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { activeCategories, categories, exportBackupText, importBackupText, resetAllData } from '../../data/store'
import { BackupError, parseBackup } from '../../data/backup'
import { CURRENT_RATES, MINIMUM_RULE } from '../../domain/rates'
import { go, openSheet, route } from '../../ui/nav'
import { Button, Choice, ConfirmButton } from '../../ui/components/controls'
import { Icon } from '../../ui/components/Icon'
import { toast } from '../../ui/components/toast'
import { setTheme, themePref, type ThemePref } from '../../ui/theme'
import {
  backupFileName,
  cardRateLines,
  cashRateLine,
  minimumLine,
  sourceLine,
  taxLine,
} from './settingsModel'
import { InstallGuide } from './InstallGuide'
import './settings-page.css'

/** Keep in step with package.json "version". */
const APP_VERSION = '0.1.0'

function Section({ title, id, children }: { title: string; id: string; children: ComponentChildren }) {
  return (
    <section class="settings-section" aria-labelledby={id}>
      <h2 class="settings-section-title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function AppearanceSection() {
  return (
    <Section title="Görünüm" id="settings-appearance">
      <div class="settings-card settings-pad">
        <Choice<ThemePref>
          legend="Tema"
          hideLegend
          look="segment"
          value={themePref.value}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'Sistem' },
            { value: 'light', label: 'Açık' },
            { value: 'dark', label: 'Koyu' },
          ]}
        />
      </div>
    </Section>
  )
}

function CategoriesSection() {
  const archived = categories.value.filter((c) => c.archived).sort((a, b) => a.order - b.order)
  const open = (id?: string) => openSheet(id ? { type: 'category', id } : { type: 'category' })
  return (
    <Section title="Kategoriler" id="settings-categories">
      <div class="settings-card">
        {activeCategories.value.map((c) => (
          <button key={c.id} type="button" class="settings-row settings-row-tap" onClick={() => open(c.id)}>
            <span class="settings-dot cat-color" style={{ '--h': c.hue }} aria-hidden="true" />
            <span class="settings-row-label">{c.name}</span>
            <Icon name="chevron" size={18} class="settings-chev" />
          </button>
        ))}
        <button type="button" class="settings-row settings-row-tap settings-row-add" onClick={() => open()}>
          <Icon name="plus" size={18} />
          <span class="settings-row-label">Kategori ekle</span>
        </button>
      </div>
      {archived.length > 0 && (
        <details class="settings-archived">
          <summary class="settings-archived-summary">Arşivdekiler ({archived.length})</summary>
          <div class="settings-card">
            {archived.map((c) => (
              <button key={c.id} type="button" class="settings-row settings-row-tap" onClick={() => open(c.id)}>
                <span class="settings-dot cat-color" style={{ '--h': c.hue }} aria-hidden="true" />
                <span class="settings-row-label settings-muted">{c.name}</span>
                <Icon name="chevron" size={18} class="settings-chev" />
              </button>
            ))}
          </div>
        </details>
      )}
    </Section>
  )
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    try {
      const text = await exportBackupText()
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName(new Date())
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke after the click has started the download; some browsers read the URL late.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('Yedek indirildi')
    } catch {
      toast('Yedek hazırlanamadı. Tekrar dene.')
    }
  }

  async function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setPending(null)
    setError(null)
    try {
      const text = await file.text()
      parseBackup(text) // Validate now so a bad file is reported before the confirm step.
      setPending(text)
    } catch (err) {
      setError(err instanceof BackupError ? err.message : 'Dosya okunamadı. Tekrar dene.')
    }
  }

  async function restore() {
    if (pending === null) return
    try {
      await importBackupText(pending)
      setPending(null)
      toast('Yedek geri yüklendi')
    } catch (err) {
      setError(err instanceof BackupError ? err.message : 'Geri yükleme tamamlanamadı. Bu cihazdaki veriler değişmedi.')
    }
  }

  return (
    <Section title="Yedek" id="settings-backup">
      <div class="settings-card settings-pad settings-stack">
        <p class="settings-text">Verilerin yalnızca bu cihazda. Telefon değiştirirken yedeği indirip yeni cihazda geri yükle.</p>
        <Button block onClick={download}>
          <Icon name="download" size={18} />
          Yedeği indir
        </Button>
        <Button block onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={18} />
          Yedekten geri yükle
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPick} />

        {error && (
          <p class="settings-error" role="alert">
            {error}
          </p>
        )}

        {pending !== null && (
          <div class="settings-confirm" role="group" aria-label="Geri yükleme onayı">
            <p class="settings-text">Bu cihazdaki bütün veriler yedektekilerle değiştirilecek.</p>
            <ConfirmButton label="Geri yükle" confirmLabel="Emin misin? Tekrar dokun" onConfirm={restore} />
            <Button variant="ghost" block onClick={() => setPending(null)}>
              Vazgeç
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}

function RatesSection() {
  const lines = [
    ...cardRateLines(CURRENT_RATES),
    cashRateLine(CURRENT_RATES),
    taxLine(),
    minimumLine(MINIMUM_RULE),
  ]
  return (
    <Section title="Faiz ve asgari ödeme kuralları" id="settings-rates">
      <div class="settings-card settings-pad settings-stack">
        <ul class="settings-rate-list">
          {lines.map((line) => (
            <li key={line} class="settings-rate-item">
              {line}
            </li>
          ))}
        </ul>
        <p class="settings-note">{sourceLine(CURRENT_RATES.source, CURRENT_RATES.effective)}</p>
        <p class="settings-note">{sourceLine(MINIMUM_RULE.source, MINIMUM_RULE.effective)}</p>
        <p class="settings-note">Bankan daha düşük oran uyguluyorsa kart ayarlarından kendi oranını girebilirsin.</p>
      </div>
    </Section>
  )
}

function PrivacySection() {
  return (
    <Section title="Gizlilik" id="settings-privacy">
      <div class="settings-card settings-pad settings-stack">
        <p class="settings-text">Hesap yok, sunucu yok. Verilerin bu cihazda kalır.</p>
        <p class="settings-text">Ekran görüntüsü içe aktarma cihazda okunur ve hiçbir yerde saklanmaz.</p>
      </div>
    </Section>
  )
}

function DangerSection() {
  async function eraseAll() {
    try {
      await resetAllData()
      toast('Bütün veriler silindi')
      go('home')
    } catch {
      toast('Veriler silinemedi. Tekrar dene.')
    }
  }
  return (
    <Section title="Tehlikeli bölge" id="settings-danger">
      <div class="settings-card settings-pad">
        <ConfirmButton label="Tüm verileri sil" confirmLabel="Geri alınamaz. Silmek için tekrar dokun" onConfirm={eraseAll} />
      </div>
    </Section>
  )
}

export function SettingsPage() {
  if (route.value !== 'settings') return null

  return (
    <div class="settings-page">
      <header class="settings-header">
        <h1>Ayarlar</h1>
      </header>
      <InstallGuide />
      <AppearanceSection />
      <CategoriesSection />
      <BackupSection />
      <RatesSection />
      <PrivacySection />
      <DangerSection />
      <footer class="settings-foot">Kart Limitlerim · sürüm {APP_VERSION}</footer>
    </div>
  )
}
