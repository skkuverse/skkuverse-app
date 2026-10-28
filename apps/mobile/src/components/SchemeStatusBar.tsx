import { StatusBar } from 'expo-status-bar';
import { useResolvedScheme } from '@skkuverse/sds';

/**
 * WHY: a surface that pins its own scheme mounts one more inside its Modal, or the root's dark text
 * vanishes over it. QUIRK(expo-status-bar): its stack restores the root's style when this unmounts.
 */
export function SchemeStatusBar() {
  const scheme = useResolvedScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
