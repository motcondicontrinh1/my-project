import { Lock } from 'lucide-react';
import TroubleshootPanel from './TroubleshootPanel.jsx';

function LockedPlaceholder() {
  return (
    <div className="tab-content tab-content--locked" role="tabpanel" aria-label="Cài đặt (khoá)">
      <div className="locked-icon" aria-hidden="true"><Lock size={48} strokeWidth={1} /></div>
      <p className="locked-msg">Tab này chỉ enable trong chế độ developer.</p>
      <p className="locked-hint">Thêm <code>?dev=1</code> vào URL để bật.</p>
    </div>
  );
}

export default function SettingsTab({ devMode, ...props }) {
  if (!devMode) return <LockedPlaceholder />;
  return (
    <div className="tab-content" role="tabpanel" aria-label="Cài đặt developer">
      <TroubleshootPanel {...props} />
    </div>
  );
}
