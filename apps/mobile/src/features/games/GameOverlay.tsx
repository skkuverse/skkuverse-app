import type { ComponentType } from 'react';
import type { GameId } from './games.constants';
import type { StageProps } from './games.types';
import { Overlay as WaveRunOverlay } from './wave-run/Overlay';
import { Overlay as SubwayTypingOverlay } from './subway-typing/Overlay';
import { Overlay as AppleGameOverlay } from './apple-game/Overlay';
import { Overlay as SuikaGameOverlay } from './suika-game/Overlay';
import { Overlay as BuildingStackOverlay } from './building-stack/Overlay';
import { Overlay as BiggerBuildingOverlay } from './bigger-building/Overlay';

// WHY: the registry is pure data, so the view each game supplies is mapped by id here.
const OVERLAYS: Record<GameId, ComponentType<StageProps>> = {
  'wave-run': WaveRunOverlay,
  'subway-typing': SubwayTypingOverlay,
  'apple-game': AppleGameOverlay,
  'suika-game': SuikaGameOverlay,
  'building-stack': BuildingStackOverlay,
  'bigger-building': BiggerBuildingOverlay,
};

export function GameOverlay({ gameId, ...stage }: StageProps & { gameId: GameId }) {
  const Overlay = OVERLAYS[gameId];
  return <Overlay {...stage} />;
}
