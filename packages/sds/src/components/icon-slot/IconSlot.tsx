import React, { useContext, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { IconContext } from 'phosphor-react-native';
import type { RecipeStyle } from '../../core/recipe';

export interface IconSlotProps {
  box: RecipeStyle;
  color: RecipeStyle['color'];
  children: ReactNode;
}

export function IconSlot({ box, color, children }: IconSlotProps) {
  const outer = useContext(IconContext);
  const size = typeof box.width === 'number' ? box.width : outer.size;
  const iconColor = typeof color === 'string' ? color : outer.color;
  const icon = useMemo(() => ({ ...outer, size, color: iconColor }), [outer, size, iconColor]);

  return (
    <View style={box} accessible={false}>
      <IconContext.Provider value={icon}>{children}</IconContext.Provider>
    </View>
  );
}
