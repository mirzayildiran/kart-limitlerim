import { go, route } from '../nav'
import { Icon } from './Icon'
import { openSheet } from '../nav'
import './tabbar.css'

export function TabBar() {
  const currentRoute = route.value

  return (
    <nav class="tabbar" aria-label="Ana menü">
      <div class="tabbar-inner">
        <button
          type="button"
          class="tab-item"
          onClick={() => go('home')}
          aria-current={currentRoute === 'home' ? 'page' : undefined}
        >
          <Icon name="home" size={22} />
          <span class="tab-label">Özet</span>
        </button>

        <button
          type="button"
          class="tab-item"
          onClick={() => go('expenses')}
          aria-current={currentRoute === 'expenses' ? 'page' : undefined}
        >
          <Icon name="list" size={22} />
          <span class="tab-label">Harcamalar</span>
        </button>

        <button
          type="button"
          class="tab-fab"
          onClick={() => openSheet({ type: 'expense' })}
          aria-label="Harcama ekle"
        >
          <Icon name="plus" size={24} />
        </button>

        <button
          type="button"
          class="tab-item"
          onClick={() => go('calendar')}
          aria-current={currentRoute === 'calendar' ? 'page' : undefined}
        >
          <Icon name="calendar" size={22} />
          <span class="tab-label">Takvim</span>
        </button>

        <button
          type="button"
          class="tab-item"
          onClick={() => go('settings')}
          aria-current={currentRoute === 'settings' ? 'page' : undefined}
        >
          <Icon name="settings" size={22} />
          <span class="tab-label">Ayarlar</span>
        </button>
      </div>
    </nav>
  )
}
