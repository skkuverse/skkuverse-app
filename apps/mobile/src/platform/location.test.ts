import { beforeEach, describe, expect, test, vi } from 'vitest';

const expoLocation = vi.hoisted(() => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: vi.fn(),
  hasServicesEnabledAsync: vi.fn(),
  getLastKnownPositionAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));
vi.mock('expo-location', () => expoLocation);

const { getFixWithoutPrompt } = await import('./location');

const HERE = { latitude: 37.5878, longitude: 126.9935 };

describe('getFixWithoutPrompt never puts up a system dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expoLocation.getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    expoLocation.hasServicesEnabledAsync.mockResolvedValue(true);
    expoLocation.getLastKnownPositionAsync.mockResolvedValue(null);
    expoLocation.getCurrentPositionAsync.mockResolvedValue({ coords: HERE });
  });

  test('asks for a fresh fix without the Android "turn on location" dialog', async () => {
    // Act
    const fix = await getFixWithoutPrompt(1000);

    // Assert
    expect(fix).toStrictEqual(HERE);
    expect(expoLocation.getCurrentPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mayShowUserSettingsDialog: false }),
    );
  });

  test('answers null without asking the OS for a fix when location services are off', async () => {
    // Arrange
    expoLocation.hasServicesEnabledAsync.mockResolvedValue(false);

    // Act
    const fix = await getFixWithoutPrompt(1000);

    // Assert
    expect(fix).toBe(null);
    expect(expoLocation.getLastKnownPositionAsync).not.toHaveBeenCalled();
    expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('answers null without a prompt when the permission is not granted', async () => {
    // Arrange
    expoLocation.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });

    // Act
    const fix = await getFixWithoutPrompt(1000);

    // Assert
    expect(fix).toBe(null);
    expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('takes a recent cached fix without waiting for the GPS', async () => {
    // Arrange
    expoLocation.getLastKnownPositionAsync.mockResolvedValue({ coords: HERE });

    // Act
    const fix = await getFixWithoutPrompt(1000);

    // Assert
    expect(fix).toStrictEqual(HERE);
    expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
