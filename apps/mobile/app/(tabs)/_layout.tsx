import { NativeTabsShell } from '@/bootstrap/NativeTabsShell';
import { SharedMapShell } from '@/bootstrap/SharedMapShell';
import { SHELL } from '@/bootstrap/shell.service';
import { initialTabRouteName } from '@/bootstrap/tabs.service';

// QUIRK(expo-router): unstable_settings is read at module evaluation time.
export const unstable_settings = {
  initialRouteName: initialTabRouteName(),
};

// WHY: one shell per launch, picked at module load; both stay in the bundle.
export default SHELL === 'shared-map' ? SharedMapShell : NativeTabsShell;
