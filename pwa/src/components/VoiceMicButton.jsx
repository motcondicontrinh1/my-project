import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupported, createRecognizer } from '../lib/voiceRecognition.js';
import { matchCommand } from '../lib/commandMatcher.js';
import { logger } from '../lib/logger.js';

const DENIED_KEY = 'voice_mic_denied';

// mode: 'unsupported' | 'denied' | 'idle' | 'listening' | 'matched' | 'unmatched'

export default function VoiceMicButton({ onCommand, disabled }) {
  const [mode,       setMode]       = useState(() => {
    if (!isSupported()) return 'unsupported';
    if (sessionStorage.getItem(DENIED_KEY)) return 'denied';
    return 'idle';
  });
  const [transcript, setTranscript] = useState('');
  const [matchedCmd, setMatchedCmd] = useState(null);
  const recRef   = useRef(null);
  const timerRef = useRef(null);

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  const stopRec = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { clearTimer(); stopRec(); }, [stopRec]);

  function handleTap() {
    if (disabled || mode === 'unsupported' || mode === 'denied') return;

    if (mode === 'listening') {
      stopRec();
      setMode('idle');
      setTranscript('');
      return;
    }

    setTranscript('');
    setMatchedCmd(null);
    setMode('listening');

    const rec = createRecognizer({
      onResult({ transcript: t, isFinal }) {
        setTranscript(t);
        logger.debug('voice', `transcript="${t}" isFinal=${isFinal}`);
        if (!isFinal) return;

        const cmd = matchCommand(t);
        if (cmd) {
          logger.info('voice', `match: ${cmd}`);
          setMatchedCmd(cmd);
          setMode('matched');
          stopRec();
          onCommand(cmd);
          timerRef.current = setTimeout(() => {
            setMode('idle');
            setTranscript('');
            setMatchedCmd(null);
          }, 600);
        } else {
          logger.info('voice', `no match: "${t}"`);
          setMode('unmatched');
          stopRec();
          timerRef.current = setTimeout(() => {
            setMode('idle');
            setTranscript('');
          }, 2500);
        }
      },
      onError(err) {
        logger.warn('voice', `error: ${err}`);
        if (err === 'not-allowed') {
          sessionStorage.setItem(DENIED_KEY, '1');
          setMode('denied');
        } else {
          setMode('idle');
        }
        setTranscript('');
        stopRec();
      },
      onEnd() {
        // If still listening (no result fired), go back to idle
        setMode((m) => (m === 'listening' ? 'idle' : m));
      },
    });

    recRef.current = rec;
    rec.start();
  }

  if (mode === 'unsupported') {
    return (
      <div className="voice-unsupported">
        <p>Trình duyệt không hỗ trợ nhận diện giọng nói.</p>
        <p>Hãy mở app trên <strong>Chrome (Android)</strong> hoặc <strong>Safari (iOS)</strong>.</p>
      </div>
    );
  }

  if (mode === 'denied') {
    return (
      <div className="voice-unsupported">
        <p>Cần quyền truy cập microphone.</p>
        <p>Vào cài đặt trình duyệt để cấp quyền, sau đó tải lại trang.</p>
      </div>
    );
  }

  const label = {
    idle:      'Nhấn để nói',
    listening: 'Đang nghe...',
    matched:   matchedCmd ? `✓ ${matchedCmd === 'OPEN' ? 'MỞ CỬA' : matchedCmd === 'CLOSE' ? 'ĐÓNG CỬA' : 'DỪNG'}` : '✓',
    unmatched: 'Không nhận ra',
  }[mode];

  return (
    <div className="voice-mic-wrap">
      <button
        type="button"
        aria-label={`Điều khiển giọng nói — ${label}`}
        aria-pressed={mode === 'listening'}
        disabled={disabled}
        className={`voice-mic-btn voice-mic-btn--${mode}`}
        onClick={handleTap}
      >
        <span className="voice-mic-icon" aria-hidden="true">
          {mode === 'matched'   ? '✓' :
           mode === 'unmatched' ? '✕' : '🎤'}
        </span>
      </button>

      <p className="voice-mic-label">{label}</p>

      {(mode === 'listening' || mode === 'unmatched') && transcript && (
        <p className="voice-transcript" aria-live="polite">
          &ldquo;{transcript}&rdquo;
        </p>
      )}

      {mode === 'idle' && (
        <ul className="voice-hints">
          <li>"Mở cửa" / "Mở"</li>
          <li>"Dừng" / "Stop"</li>
          <li>"Đóng cửa" / "Đóng"</li>
        </ul>
      )}
    </div>
  );
}
