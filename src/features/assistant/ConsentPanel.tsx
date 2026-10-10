import type { BudgetSummary } from '../../domain/insightsTypes'
import { Button } from '../../ui/components/controls'
import { PROVIDERS } from './assistantModel'
import './consent-panel.css'

interface Props {
  summary: BudgetSummary
  onAccept: () => void
}

const SENT = [
  'Harcama gücü toplamları ve kesime kadar görünüm',
  'Hesap adların, limitler, bakiyeler ve ekstre tutarları',
  'Bu ay ve geçen ay kategori toplamları',
  'Bütçe planın (kategori hedefleri) ve bu ayki harcama gidişatı',
  'Cihazdaki öneriler',
  'Sohbete yazdığın mesajlar',
]

const NOT_SENT = [
  'Tek tek harcamaların ve notların',
  'Düzenli ödeme adların',
  'Yedek dosyan',
  'Kart numarası, şifre gibi bilgiler (uygulama zaten istemez)',
]

export function ConsentPanel({ summary, onAccept }: Props) {
  return (
    <section class="consent-panel" aria-labelledby="consent-title">
      <h3 class="consent-title" id="consent-title">
        Sohbeti açmadan önce
      </h3>

      <p class="consent-text">
        Sohbet açılırsa her mesajında aşağıdaki özet ve yazdığın mesaj, Kart Limitlerim'in aracı sunucusu
        (Cloudflare) üzerinden bir yapay zekâ servisine gönderilir.
      </p>

      <div class="consent-group">
        <p class="consent-label">Gönderilenler</p>
        <ul class="consent-list">
          {SENT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div class="consent-group">
        <p class="consent-label">Gönderilmeyenler</p>
        <ul class="consent-list">
          {NOT_SENT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div class="consent-group">
        <p class="consent-label">Servisler</p>
        <ul class="consent-list">
          {PROVIDERS.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong>: {p.note}
            </li>
          ))}
        </ul>
        <p class="consent-note">
          Aracı sunucu mesajlarını ve özetini kaydetmez; yalnızca kötüye kullanımı önlemek için IP adresini bir
          saatlik sayaçta tutar.
        </p>
      </div>

      <details class="consent-details">
        <summary class="consent-summary">Gönderilecek özeti göster</summary>
        <pre class="consent-json">{JSON.stringify(summary, null, 2)}</pre>
      </details>

      <p class="consent-note">
        Onayını istediğin an buradan ya da Ayarlar'dan geri alabilirsin. Ayrıntılar uygulamanın gizlilik politikasında.
      </p>

      <Button variant="primary" block onClick={onAccept}>
        Anladım, sohbeti aç
      </Button>
    </section>
  )
}
