import { useState } from 'react';
import type { SyncReport, SyncSavedReply } from '../messages';
import SignInDialog from './SignInDialog';

/**
 * A one-line, human-readable summary of a completed run, e.g.
 * "12 added, 46 refreshed, 3 no longer saved."
 */
function summarize(report: SyncReport): string {
  const bits: string[] = [];
  if (report.added) bits.push(`${report.added} added`);
  if (report.refreshed) bits.push(`${report.refreshed} refreshed`);
  if (report.warned) bits.push(`${report.warned} no longer saved`);
  if (report.rejected) bits.push(`${report.rejected} couldn't be read`);

  if (bits.length === 0) return `${report.entriesSeen} entries, nothing new.`;
  return bits.join(', ') + '.';
}

export default function SyncButton() {
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<SyncSavedReply | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  async function handleSync() {
    setBusy(true);
    setReply(null);
    try {
      const answer = (await browser.runtime.sendMessage({ type: 'sync-saved' })) as SyncSavedReply;
      if (!answer.ok && answer.needsSignIn) {
        setSignInOpen(true);
      } else {
        setReply(answer);
      }
    } catch (error) {
      setReply({ ok: false, reason: error instanceof Error ? error.message : String(error) });
    }
    setBusy(false);
  }

  return (
    <div className="sync">
      <button
        disabled={busy}
        onClick={() => void handleSync()}
        title="Opens your Substack Saved List and adds new articles to the board. Articles already on the board are refreshed; ones you've unsaved are flagged."
      >
        {busy ? 'Importing…' : 'Import Saved Articles'}
      </button>

      {reply?.ok === false ? <p className="notice error">{reply.reason}</p> : null}

      {reply?.ok === true && reply.report.problem ? (
        <p className="notice error">{reply.report.problem}</p>
      ) : null}

      {reply?.ok === true && !reply.report.problem ? (
        <p className="notice">
          {summarize(reply.report)}
          {reply.report.complete
            ? ''
            : ` Only the first ${reply.report.entriesSeen} entries loaded, so nothing was flagged as missing.`}
        </p>
      ) : null}

      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
