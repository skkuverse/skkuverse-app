import { useState } from 'react';
import { Image } from 'react-native';
import type { Logo } from '@skkuverse/shared';
import { MiniAppEmojiLogo } from '@/components/MiniAppEmojiLogo';
import { Favicon } from './Favicon';

/** WHY: no logo is bundled, so a new mini app needs no release. */
export function ServiceLogo({
  logo,
  faviconUri,
  size,
}: {
  logo: Logo | null;
  faviconUri: string | null;
  size: number;
}) {
  const uri = logo?.kind === 'remote' ? logo.uri : undefined;
  // WHY: a new uri resets the failure during render, so it never paints a frame as failed.
  const [failed, setFailed] = useState(false);
  const [seenUri, setSeenUri] = useState(uri);
  if (seenUri !== uri) {
    setSeenUri(uri);
    setFailed(false);
  }

  if (logo?.kind === 'emoji') {
    return <MiniAppEmojiLogo emoji={logo.emoji} size={size} />;
  }
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return <Favicon uri={faviconUri} size={size} />;
}

