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
 *
 * Several fields can be pending at once: the notes box and a quote comment each
 * run their own debounce. `pending` counts them, so one field finishing or
 * giving up does not announce a card that another field is still writing. The
 * indicator only leaves "saving" when the last pending save resolves.
 *
 * The contract each caller owes: one `beginSave` per idle-to-pending
 * transition, and exactly one `endSave` or `abortSave` when that pending write
 * resolves or is dropped. The counter returns to zero when both sides hold.
 */
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>('idle');

  // Held in a ref, not in state, so a second save landing during the two-second
  // window cancels the first timer instead of racing it back to idle.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // How many announced saves have not yet resolved or been dropped.
  const pending = useRef(0);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function beginSave() {
    pending.current += 1;
    clearTimer();
    setStatus('saving');
  }

  function endSave() {
    pending.current = Math.max(0, pending.current - 1);
    if (pending.current > 0) return; // Another field is still writing.
    clearTimer();
    setStatus('saved');
    timer.current = setTimeout(() => setStatus('idle'), SAVED_MS);
  }

  /**
   * A save that was announced with `beginSave` is no longer coming: the field
   * unmounted, or the selected card changed under it, before the debounced
   * write fired. Land the indicator back on idle rather than stranding it on
   * "saving" until the next real edit.
   *
   * Only once nothing else is pending. A quote comment abandoning its debounce
   * must not report the card as quiet while the notes write is still in flight.
   */
  function abortSave() {
    pending.current = Math.max(0, pending.current - 1);
    if (pending.current > 0) return;
    clearTimer();
    setStatus('idle');
  }

  return { status, beginSave, endSave, abortSave };
}
