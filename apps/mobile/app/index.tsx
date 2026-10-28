import { Redirect } from 'expo-router';

// WHY: bare `/` is routed by redirectSystemPath, so this never mounts; it catches a `/` pushed from code.
// SEE: docs/reference/deep-link.md
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
