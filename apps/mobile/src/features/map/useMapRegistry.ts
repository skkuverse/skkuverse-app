import { createContext, useContext } from 'react';
import type { MapRegistry } from './map-host.types';

export const MapRegistryContext = createContext<MapRegistry | null>(null);

export function useMapRegistry(): MapRegistry {
  const value = useContext(MapRegistryContext);
  if (!value) throw new Error('useMapRegistry: rendered outside a MapHost');
  return value;
}
