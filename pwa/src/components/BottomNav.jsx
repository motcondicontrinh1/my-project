// Bottom navigation bar — 3 tabs: Home, Micro (voice), Settings.
// Settings tab is disabled (no-op tap) when devMode is false.

const TABS = [
  { id: 'home',     label: 'Home',      icon: '🏠' },
  { id: 'micro',    label: 'Giọng nói', icon: '🎤' },
  { id: 'settings', label: 'Cài đặt',   icon: '⚙' },
];

export default function BottomNav({ activeTab, onTabChange, devMode }) {
  return (
    <nav className="bottom-nav" role="tablist" aria-label="Điều hướng chính">
      {TABS.map(({ id, label, icon }) => {
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
              {icon}
              {isDisabled && <span className="bottom-nav__lock" aria-hidden="true">🔒</span>}
            </span>
            <span className="bottom-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
