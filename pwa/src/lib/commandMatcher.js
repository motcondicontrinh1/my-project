// Pure function: match a Vietnamese voice transcript to a door command.
// Strips diacritics before matching so "mở" and "mo" both work.
// STOP is checked first (safety priority).

function stripDiacritics(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const PATTERNS = {
  STOP:  /\b(dung|stop)\b/i,
  OPEN:  /\b(mo|len)\b/i,
  CLOSE: /\b(dong|xuong)\b/i,
};

/**
 * @param {string} transcript
 * @returns {'OPEN'|'STOP'|'CLOSE'|null}
 */
export function matchCommand(transcript) {
  if (!transcript) return null;
  const normalized = stripDiacritics(transcript.trim().toLowerCase());
  for (const [cmd, pattern] of Object.entries(PATTERNS)) {
    if (pattern.test(normalized)) return cmd;
  }
  return null;
}
