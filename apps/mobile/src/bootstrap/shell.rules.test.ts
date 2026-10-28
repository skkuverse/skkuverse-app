/**
 * The shell a launch runs: the shared map on every build, prerelease and store
 * alike, unless the local override names one (ADR 0023, update 2026-10-25).
 */

import { describe, it, expect } from 'vitest';
import { decideShell } from './shell.rules';

describe('decideShell', () => {
  it('runs the shared map with no override', () => {
    // Act
    const shell = decideShell(null);
    // Assert
    expect(shell).toBe('shared-map');
  });

  it('runs whichever shell the local override names', () => {
    // Act / Assert
    expect(decideShell('native-tabs')).toBe('native-tabs');
    expect(decideShell('shared-map')).toBe('shared-map');
  });
});
