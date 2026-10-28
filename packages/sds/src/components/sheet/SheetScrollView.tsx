/** QUIRK(gorhom-bottom-sheet): gorhom calls `scrollEventsHandlersHook` as a hook, so the one from `SheetScrollEventsContext` must keep one identity. */

import { forwardRef, use, type ComponentProps } from 'react';
import { BottomSheetScrollView, type BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { SheetScrollEventsContext } from '../../core/SheetScrollEventsContext';

export const SheetScrollView = forwardRef<BottomSheetScrollViewMethods, ComponentProps<typeof BottomSheetScrollView>>(
  function SheetScrollView(props, ref) {
    const hook = use(SheetScrollEventsContext);
    return <BottomSheetScrollView ref={ref} {...(hook && { scrollEventsHandlersHook: hook })} {...props} />;
  },
);
