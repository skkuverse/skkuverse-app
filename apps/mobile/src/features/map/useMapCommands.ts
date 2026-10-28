import { createContext, useContext } from 'react';
import type { MapCommands } from './map-host.types';

export const MapCommandsContext = createContext<MapCommands | null>(null);

export function useMapCommands(): MapCommands {
  const value = useContext(MapCommandsContext);
  if (!value) throw new Error('useMapCommands: rendered outside a MapHost');
  return value;
}
