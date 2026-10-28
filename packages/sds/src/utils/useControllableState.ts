/** WHY: unlike `useControlled`, a change is reported to `onChange` in both modes, which is what the `on{State}Change` props promise. */
import { useCallback, useState } from 'react';
import { requestControllableChange, resolveControllable } from './controllableState';

export interface UseControllableStateOptions<T> {
  value: T | undefined;
  defaultValue: T;
  onChange?: (next: T) => void;
}

export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateOptions<T>): [T, (next: T) => void] {
  const [internal, setInternal] = useState(defaultValue);

  const setValue = useCallback(
    (next: T) => {
      const change = requestControllableChange(value, internal, next);
      if (!Object.is(change.internal, internal)) setInternal(change.internal);
      if (change.notify) onChange?.(next);
    },
    [value, internal, onChange],
  );

  return [resolveControllable(value, internal), setValue];
}
