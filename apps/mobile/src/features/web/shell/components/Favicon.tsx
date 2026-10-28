import { useState } from 'react';
import { Image } from 'react-native';
import { GlobeSimpleIcon } from 'phosphor-react-native';
import { SdsRadius } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';

/** WHY: a new uri resets the failure during render, not in an effect, so no frame paints as failed. */
export function Favicon({ uri, size }: { uri: string | null; size: number }) {
  const color = useSemanticColors();
  const [failed, setFailed] = useState(false);
  const [seenUri, setSeenUri] = useState(uri);
  if (seenUri !== uri) {
    setSeenUri(uri);
    setFailed(false);
  }

  if (!uri || failed) {
    return <GlobeSimpleIcon size={size} color={color.fg.neutralSubtle} />;
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: SdsRadius.r1 }}
      onError={() => setFailed(true)}
    />
  );
}

