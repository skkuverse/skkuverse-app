import { useEffect, useState } from 'react';
import { Toast } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import { unopenableGameTap } from './web.service';

/**
 * WHY: a tap that opens nothing would look dead without a word. At the top, since from the root
 * layout's slot the toast cannot know what the screen has at the bottom (a tab bar, an accessory,
 * a fixed CTA) and would cover it (TOAST-06).
 */
export function UnopenableGameToast() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => unopenableGameTap.subscribe(() => setOpen(true)), []);
  return (
    <Toast
      open={open}
      position="top"
      text={t('game.unavailable')}
      icon={<Toast.Icon type="error" />}
      onClose={() => setOpen(false)}
    />
  );
}
