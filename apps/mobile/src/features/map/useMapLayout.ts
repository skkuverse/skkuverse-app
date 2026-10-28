import { createContext, useContext } from 'react';
import type { MapLayout } from './map-host.types';

export const MapLayoutContext = createContext<MapLayout | null>(null);

export function useMapLayout(): MapLayout {
  const value = useContext(MapLayoutContext);
  if (!value) throw new Error('useMapLayout: rendered outside a MapHost');
  return value;
}
