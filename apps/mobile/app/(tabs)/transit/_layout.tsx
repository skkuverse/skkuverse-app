import { Slot, Stack } from 'expo-router';
import { SHELL } from '@/bootstrap/shell.service';

// WHY: the tab's own Stack keeps its header hidden statically, so a tab switch never toggles a header and shifts content.
function TransitStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

// WHY: a nested Stack's screen takes the touch and paints over the shared map; full pages push on the root Stack.
// SEE: docs/explanation/shared-map.md
function TransitSlotLayout() {
  return <Slot />;
}

export default SHELL === 'shared-map' ? TransitSlotLayout : TransitStackLayout;
