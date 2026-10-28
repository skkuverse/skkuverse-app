import { createContext, useContext } from 'react';
import type { MapWorld } from './map-host.types';

export const MapWorldContext = createContext<MapWorld | null>(null);

export function useMapWorld(): MapWorld {
  const value = useContext(MapWorldContext);
  if (!value) throw new Error('useMapWorld: rendered outside a MapHost');
  return value;
}
