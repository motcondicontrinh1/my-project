// Web Speech API wrapper.
// Isolates cross-browser quirks (webkit prefix, iOS Safari end-event timeout).
//
// Usage:
//   if (!isSupported()) { /* show fallback */ }
//   const rec = createRecognizer({ onResult, onError, onEnd });
//   rec.start();
//   rec.stop();

const IOS_TIMEOUT_MS = 8000;

export function isSupported() {
  return typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * @param {{
 *   lang?: string,
 *   onResult: (result: {transcript: string, isFinal: boolean}) => void,
 *   onError?: (err: string) => void,
 *   onEnd?: () => void,
 * }} opts
 * @returns {{ start: () => void, stop: () => void }}
 */
export function createRecognizer({ lang = 'vi-VN', onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;

  let iosTimer = null;

  function clearIosTimer() {
    if (iosTimer) { clearTimeout(iosTimer); iosTimer = null; }
  }

  rec.onresult = (e) => {
    clearIosTimer();
    const result = e.results[e.results.length - 1];
    const transcript = result[0].transcript;
    const isFinal = result.isFinal;
    onResult({ transcript, isFinal });
  };

  rec.onerror = (e) => {
    clearIosTimer();
    onError?.(e.error ?? 'unknown');
  };

  rec.onend = () => {
    clearIosTimer();
    onEnd?.();
  };

  return {
    start() {
      rec.start();
      // iOS Safari sometimes never fires 'end' — force stop after timeout
      iosTimer = setTimeout(() => { try { rec.stop(); } catch { /* ignore */ } }, IOS_TIMEOUT_MS);
    },
    stop() {
      clearIosTimer();
      try { rec.stop(); } catch { /* ignore if already stopped */ }
    },
  };
}
