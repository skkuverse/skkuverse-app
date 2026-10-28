/** WHY: a confirm closes only through its buttons unless the caller opts in, since a tap outside would report no choice at all (DIALOG-03). */
export type DialogKind = 'alert' | 'confirm';

export function closesOnDimmerTap(kind: DialogKind, closeOnDimmerClick: boolean | undefined): boolean {
  return closeOnDimmerClick ?? kind === 'alert';
}
