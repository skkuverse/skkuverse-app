/** WHY: binary formats the in-app browser cannot render, so they only download. */
const NO_PREVIEW_EXTS = new Set([
  '.hwp',
  '.hwpx',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
]);

/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/notices/attachment/notices-attachment.constants.ts
 * `EXT_MIME` holds the image types the proxy names; `.webp` falls back to octet-stream and fails to load.
 * Grow this with that map.
 */
const THUMBNAIL_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif']);

export type AttachmentKind =
  | 'image'
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'slide'
  | 'archive'
  | 'other';

export function getExtension(name: string): string {
  return (name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
}

export function canPreview(name: string): boolean {
  return !NO_PREVIEW_EXTS.has(getExtension(name));
}

export function canThumbnail(name: string): boolean {
  return THUMBNAIL_EXTS.has(getExtension(name));
}

export function getAttachmentKind(name: string): AttachmentKind {
  const ext = getExtension(name);
  if (THUMBNAIL_EXTS.has(ext) || ext === '.webp' || ext === '.bmp') return 'image';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.hwp' || ext === '.hwpx' || ext === '.doc' || ext === '.docx') return 'doc';
  if (ext === '.xls' || ext === '.xlsx' || ext === '.csv') return 'sheet';
  if (ext === '.ppt' || ext === '.pptx') return 'slide';
  if (ext === '.zip' || ext === '.rar' || ext === '.7z') return 'archive';
  return 'other';
}

export function getExtensionLabel(name: string): string | null {
  const ext = getExtension(name);
  return ext ? ext.slice(1).toUpperCase() : null;
}

/** WHY: some department servers block hotlinks, so the proxy adds the Referer and gnuboard's PHPSESSID. */
export function buildAttachmentUrl(
  url: string,
  sourceUrl: string,
  mode: 'inline' | 'download',
  name?: string,
): string {
  const params = new URLSearchParams({ url, referer: sourceUrl, mode });
  if (name) params.set('name', name);
  return `https://files.skkuverse.com/notices/proxy/attachment?${params.toString()}`;
}
