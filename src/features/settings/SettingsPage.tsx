import type { ComponentChildren } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { activeCategories, categories, exportBackupText, importBackupText, resetAllData } from '../../data/store'
import { displayHue } from '../../domain/categories'
import { BackupError, parseBackup } from '../../data/backup'
import { go, openSheet, route } from '../../ui/nav'
import { Button, Choice, ConfirmButton } from '../../ui/components/controls'
import { Icon } from '../../ui/components/Icon'
import { figure } from '../../ui/components/Amount'
import { toast } from '../../ui/components/toast'
import { setTheme, themePref, type ThemePref } from '../../ui/theme'
import { backupFileName, rateGroups, sourceLines, type RateRow } from './settingsModel'
import { isNativeApp, saveTextFile } from '../../platform/files'
import { InstallGuide } from './InstallGuide'
import './settings-page.css'

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
      <div class="settings-card settings-pad settings-theme">
        <Choice<ThemePref>
          legend="Tema"
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
            <span class="settings-dot cat-color" style={{ '--h': displayHue(c.hue) }} aria-hidden="true" />
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
        <div class="settings-card settings-archived">
          <details>
            <summary class="settings-row settings-row-tap settings-archived-summary">
              <span class="settings-row-label">Arşivdekiler ({archived.length})</span>
              <Icon name="chevron" size={18} class="settings-chev" />
            </summary>
            <div class="settings-archived-list">
              {archived.map((c) => (
                <button key={c.id} type="button" class="settings-row settings-row-tap" onClick={() => open(c.id)}>
                  <span class="settings-dot cat-color" style={{ '--h': displayHue(c.hue) }} aria-hidden="true" />
                  <span class="settings-row-label settings-muted">{c.name}</span>
                  <Icon name="chevron" size={18} class="settings-chev" />
                </button>
              ))}
            </div>
          </details>
        </div>
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
      const saved = await saveTextFile(backupFileName(new Date()), text, 'application/json')
      if (saved) toast(isNativeApp ? 'Yedek hazır' : 'Yedek indirildi')
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
        <p class="settings-text">Verilerin yalnızca bu cihazda duruyor. Telefon değiştirirken yedeği indirip yeni cihazda geri yükle.</p>
        <div class="settings-actions">
          <Button block onClick={download}>
            <Icon name="download" size={18} />
            Yedeği indir
          </Button>
          <Button block onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} />
            Yedekten geri yükle
          </Button>
        </div>
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
            <Button variant="secondary" block onClick={() => setPending(null)}>
              Vazgeç
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}

/** One definition list; each row has its label left and its figures right, one figure per line. */
function RateList({ rows, class: cls }: { rows: RateRow[]; class?: string }) {
  return (
    <dl class={cls ? `settings-rates ${cls}` : 'settings-rates'}>
      {rows.map((row) => (
        <div key={row.label} class="settings-rate">
          <dt class="settings-rate-label">{row.label}</dt>
          <dd class="settings-rate-value num">
            {row.lines.map((line) => (
              <span key={line} class="settings-rate-line">
                {figure(line)}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function RatesSection() {
  const { interest, charges } = rateGroups()
  return (
    <Section title="Faiz nasıl tahmin ediliyor" id="settings-rates">
      <p class="settings-lead">Bunlar tahmindir. Esas olan bankanın ekstresidir.</p>
      <div class="settings-card">
        <RateList rows={interest} />
        <RateList rows={charges} class="settings-rates-charges" />
      </div>
      <div class="settings-captions">
        {sourceLines().map((line) => (
          <p key={line} class="settings-caption">
            {line}
          </p>
        ))}
        <p class="settings-caption">Bankan daha düşük oran uyguluyorsa kart ayarlarından kendi oranını girebilirsin.</p>
      </div>
    </Section>
  )
}

function PrivacySection() {
  return (
    <Section title="Gizlilik" id="settings-privacy">
      <div class="settings-card settings-pad settings-stack">
        <p class="settings-text">Kart numaran ya da banka şifren hiçbir zaman sorulmaz.</p>
        <p class="settings-text">Ekran görüntüsü içe aktarma cihazda okunur ve hiçbir yerde saklanmaz.</p>
        <p class="settings-text">Tek istisna bütçe asistanı sohbetidir: açarsan, onay ekranında gösterilen özet ve mesajların bir yapay zekâ servisine gönderilir.</p>
      </div>
    </Section>
  )
}

function AssistantSection() {
  return (
    <Section title="Bütçe asistanı" id="settings-assistant">
      <div class="settings-card settings-pad settings-stack">
        <p class="settings-text">Bütçene göre öneriler ve isteğe bağlı sohbet. Sohbet açılmadan hiçbir veri gönderilmez.</p>
        <Button variant="secondary" block onClick={() => go('assistant')}>
          Asistanı aç
        </Button>
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
      <div class="settings-card settings-pad settings-danger settings-stack">
        <p class="settings-text">Bu işlem bu cihazdaki bütün verileri siler ve geri alınamaz.</p>
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
        <p class="settings-caption">Hesap yok. Verilerin bu cihazda kalır.</p>
      </header>
      <AppearanceSection />
      <CategoriesSection />
      <BackupSection />
      <RatesSection />
      <AssistantSection />
      <PrivacySection />
      <InstallGuide />
      <DangerSection />
      <footer class="settings-foot">Kart Limitlerim · sürüm {__APP_VERSION__}</footer>
    </div>
  )
}
