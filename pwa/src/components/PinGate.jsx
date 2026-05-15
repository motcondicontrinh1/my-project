import { useState } from 'react';

// Simple UI PIN gate. As the plan notes: this prevents accidental taps and
// casual access — it is NOT real security. Real security comes later via a
// backend (see plan, "Future Improvements").
export default function PinGate({ expectedPin, onUnlock }) {
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState(false);

  function submit(e) {
    e.preventDefault();
    if (pin === expectedPin) {
      onUnlock(pin);
    } else {
      setError(true);
      setPin('');
    }
  }

  return (
    <main className="gate">
      <div className="brand">
        <span className="m-stripe" aria-hidden="true">
          <span /><span /><span />
        </span>
        <h1>Cửa Cuốn</h1>
      </div>
      <form onSubmit={submit} className="gate-form" noValidate>
        <label htmlFor="pin" className="gate-label">Nhập mã PIN</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          maxLength={8}
          aria-invalid={error}
          className="gate-input"
        />
        {error && <p className="gate-error">Mã PIN không đúng</p>}
        <button type="submit" className="gate-submit" disabled={pin.length === 0}>
          Mở khoá
        </button>
      </form>
    </main>
  );
}
