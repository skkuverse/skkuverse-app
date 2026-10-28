import { useMapStore } from '../map.store';

export function useFilterLayerState() {
  const setLayerOverride = useMapStore((s) => s.setLayerOverride);
  return { setLayerOverride };
}
