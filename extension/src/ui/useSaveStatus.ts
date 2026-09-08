import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved';

/** How long "Saved" stays on screen before the editor goes quiet again. */
const SAVED_MS = 2000;

/**
 * One save indicator for one editor.
 *
 * Every field in the editor reports through the same instance, because the
 * editor writes one card. Two markers disagreeing about whether the card is
 * saved is a question the reader should never have to answer.
 *
 * `beginSave` is called when a debounce starts, not when the write is issued:
 * the seconds between the last keystroke and the write are exactly when the
 * reader most wants to know something is pending.
 *
 * A write that never resolves leaves the indicator at "saving". That is the
 * honest report. This extension has no error toast, and the absence of a
 * success is the failure signal.
 */
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>('idle');

  // Held in a ref, not in state, so a second save landing during the two-second
  // window cancels the first timer instead of racing it back to idle.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function beginSave() {
    if (timer.current) clearTimeout(timer.current);
    setStatus('saving');
  }

  function endSave() {
    setStatus('saved');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), SAVED_MS);
  }

  return { status, beginSave, endSave };
}
