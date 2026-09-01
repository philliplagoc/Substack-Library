/**
 * Hand the browser a file to save.
 *
 * The blob-and-anchor sequence `BackupControls` has used since Milestone 1. The
 * extension has no `downloads` permission and needs none.
 *
 * The MIME type is a parameter rather than a hardcoded `text/markdown`, because
 * the third caller is the JSON backup.
 */
export function downloadFile(filename: string, text: string, type: string): void {
  const href = URL.createObjectURL(new Blob([text], { type }));

  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(href);
}
