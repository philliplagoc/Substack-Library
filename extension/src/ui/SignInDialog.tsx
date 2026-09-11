import { useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';

/** Lands the reader back on their Saved list once they've signed in. */
const SIGN_IN_URL = 'https://substack.com/sign-in?redirect=%2Fsaved';

/**
 * Tells the reader they need to sign in to Substack before the Saved list
 * can be read, and offers to open the sign-in page.
 *
 * A native `<dialog>` rather than overlay markup of our own: the extension
 * has no modal or toast system today (`useSaveStatus.ts` says so explicitly),
 * so this borrows focus trapping, Escape-to-close, and a `::backdrop` from
 * the platform instead of building any of that. `showModal`/`close` are
 * imperative calls, not props, so an effect drives them off `open`.
 *
 * Every way of leaving the dialog — Cancel, signing in, Escape, or a
 * backdrop click — funnels through `onClose`, so the parent's `open` state
 * never falls out of sync with what's actually on screen.
 */
export default function SignInDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /*
   * Called straight out of the click handler, the same precedent as
   * `allowCapture` in `ReadingPanel.tsx`: this needs no reply from the
   * background, so no message is worth routing through it.
   */
  function signIn() {
    void browser.tabs.create({ url: SIGN_IN_URL });
    onClose();
  }

  return (
    <dialog
      ref={ref}
      className="signin-dialog"
      aria-labelledby="signin-dialog-title"
      onClose={onClose}
    >
      <h2 id="signin-dialog-title">Sign in required</h2>
      <p>Sign in to Substack to read your Saved list.</p>
      <div className="signin-dialog-actions">
        <button type="button" className="signin-dialog-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="signin-dialog-primary" onClick={signIn}>
          Sign in to Substack
        </button>
      </div>
    </dialog>
  );
}
