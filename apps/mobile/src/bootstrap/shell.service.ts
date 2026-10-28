import { decideShell, type Shell } from './shell.rules';

// WHY: a developer's local switch to see the native tabs; never commit a forced value.
const SHELL_OVERRIDE: Shell | null = null;

// WHY: decided once at module load; only route files read it, a feature never does.
export const SHELL: Shell = decideShell(SHELL_OVERRIDE);
