import { useState } from 'react';
import type { SyncReport, SyncSavedReply } from '../messages';

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

  async function handleSync() {
    setBusy(true);
    setReply(null);
    try {
      const answer = (await browser.runtime.sendMessage({ type: 'sync-saved' })) as SyncSavedReply;
      setReply(answer);
    } catch (error) {
      setReply({ ok: false, reason: error instanceof Error ? error.message : String(error) });
    }
    setBusy(false);
  }

  return (
    <div className="sync">
      <button disabled={busy} onClick={() => void handleSync()}>
        {busy ? 'Syncing…' : 'Sync Saved'}
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
    </div>
  );
}
