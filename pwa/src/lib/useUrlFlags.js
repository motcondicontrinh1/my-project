import { useMemo } from 'react';

// Parse URL query flags once per session.
//   ?preview=1         — suppress family-facing setup errors so the UI can be
//                        rendered without real broker credentials
//   ?dev=1 or ?trace=1 — show the developer Troubleshooting panel
//
// Both can be combined: ?preview=1&dev=1 is the main test scenario.
export function useUrlFlags() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { preview: false, dev: false };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      preview: params.has('preview'),
      dev:     params.has('dev') || params.has('trace'),
    };
  }, []);
}
