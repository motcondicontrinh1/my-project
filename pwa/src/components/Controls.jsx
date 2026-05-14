// Three action buttons per plan, Task 8:
//   Mở cửa  — green, secondary emphasis
//   Dừng    — amber, large and central, single-tap (no confirm)
//   Đóng cửa — red, secondary emphasis
export default function Controls({ onCommand, disabled }) {
  return (
    <section className="controls" aria-label="Điều khiển cửa">
      <button
        type="button"
        className="btn btn-action tone-open"
        disabled={disabled}
        onClick={() => onCommand('OPEN')}
      >
        <span className="btn-eyebrow">Lệnh</span>
        <span className="btn-label">Mở cửa</span>
      </button>

      <button
        type="button"
        className="btn btn-action tone-stop"
        onClick={() => onCommand('STOP')}
      >
        <span className="btn-eyebrow">Khẩn cấp</span>
        <span className="btn-label">Dừng</span>
      </button>

      <button
        type="button"
        className="btn btn-action tone-close"
        disabled={disabled}
        onClick={() => onCommand('CLOSE')}
      >
        <span className="btn-eyebrow">Lệnh</span>
        <span className="btn-label">Đóng cửa</span>
      </button>
    </section>
  );
}
