/** WHY: chipState.test.mts loads this file under plain Node, so it imports types only. */
import type { AccessibilityRole, AccessibilityState } from 'react-native';
import type { PressFeedbackKind } from '../../core/pressFeedback';

export type ChipKind = 'button' | 'toggle' | 'radio';

export interface ChipAccessibility {
  role: AccessibilityRole;
  state: AccessibilityState;
}

/** QUIRK(android): a toggle or radio reports its selection as `checked`; with `selected`, Android announces those checkable roles as not checked. */
export function chipAccessibility(
  kind: ChipKind,
  { selected, disabled }: { selected: boolean; disabled: boolean },
): ChipAccessibility {
  switch (kind) {
    case 'button':
      return { role: 'button', state: { disabled } };
    case 'toggle':
      return { role: 'togglebutton', state: { checked: selected, disabled } };
    case 'radio':
      return { role: 'radio', state: { checked: selected, disabled } };
  }
}

/** WHY: a selected chip only shrinks; its fill already shows the state, and a color change under the finger would read as the state changing early (ADR 0014). */
export function chipFeedback(selected: boolean): PressFeedbackKind {
  return selected ? 'scale' : 'both';
}

export function togglePressed(checked: boolean): boolean {
  return !checked;
}

export function isRadioItemSelected(groupValue: string | null, itemValue: string): boolean {
  return groupValue === itemValue;
}
