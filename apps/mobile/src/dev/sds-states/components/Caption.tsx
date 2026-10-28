import React, { type ReactNode } from 'react';
import { Txt } from '@skkuverse/sds';

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Txt typography="t2" color="neutralSubtle">
      {children}
    </Txt>
  );
}
