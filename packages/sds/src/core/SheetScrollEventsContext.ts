import { createContext } from 'react';
import type { ScrollEventsHandlersHookType } from '@gorhom/bottom-sheet';

export const SheetScrollEventsContext = createContext<ScrollEventsHandlersHookType | null>(null);
