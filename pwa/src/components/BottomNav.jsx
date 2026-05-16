import { Home, Mic, Settings, Lock } from 'lucide-react';

const TABS = [
  { id: 'home',     label: 'Home',      Icon: Home     },
  { id: 'micro',    label: 'Giọng nói', Icon: Mic      },
  { id: 'settings', label: 'Cài đặt',   Icon: Settings },
];

export default function BottomNav({ activeTab, onTabChange, devMode }) {
  return (
    <nav className="bottom-nav" role="tablist" aria-label="Điều hướng chính">
      {TABS.map(({ id, label, Icon }) => {
        const isDisabled = id === 'settings' && !devMode;
        const isActive   = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            aria-label={isDisabled ? `${label} (chỉ dành cho developer)` : label}
            className={[
              'bottom-nav__item',
              isActive   ? 'bottom-nav__item--active'   : '',
              isDisabled ? 'bottom-nav__item--disabled' : '',
            ].join(' ').trim()}
            onClick={() => { if (!isDisabled) onTabChange(id); }}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              <Icon size={22} strokeWidth={1.5} />
              {isDisabled && (
                <span className="bottom-nav__lock" aria-hidden="true">
                  <Lock size={10} strokeWidth={2} />
                </span>
              )}
            </span>
            <span className="bottom-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
