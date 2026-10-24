import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodePreferences,
  DEFAULT_PREFERENCES,
  encodePreferences,
} from '../src/features/settings/preferences.ts';

test('round-trips all preferences including independent accidental conventions', () => {
  const preferences = {
    ...DEFAULT_PREFERENCES,
    tonic: 11,
    notation: 'sargam' as const,
    accidentals: 'flats' as const,
    octave: 5,
    volume: 0,
    haptics: false,
  };
  assert.deepEqual(decodePreferences(encodePreferences(preferences)), preferences);
});

test('handles absent, corrupt and unknown-version storage safely', () => {
  for (const value of [null, '', '{broken', 'null', '[]', '{"version":2,"preferences":{}}']) {
    assert.deepEqual(decodePreferences(value), DEFAULT_PREFERENCES);
  }
});

test('restores Phase 1 settings with a default direction and retains the saved scale', () => {
  const restored = decodePreferences(
    JSON.stringify({ version: 1, preferences: { tonic: 7, scale: 'major' } }),
  );
  assert.equal(restored.tonic, 7);
  assert.equal(restored.scale, 'major');
  assert.equal(restored.direction, 'ascending');
});

test('persists scale and direction without allowing saved data to start a drone', () => {
  const restored = decodePreferences(
    JSON.stringify({
      version: 1,
      preferences: {
        ...DEFAULT_PREFERENCES,
        scale: 'melodicMinor',
        direction: 'descending',
        droneEnabled: true,
      },
    }),
  );
  assert.equal(restored.scale, 'melodicMinor');
  assert.equal(restored.direction, 'descending');
  assert.equal('droneEnabled' in restored, false);
});

test('retains valid fields while rejecting invalid saved values', () => {
  const decoded = decodePreferences(
    JSON.stringify({
      version: 1,
      preferences: {
        tonic: -1,
        octave: 1.5,
        volume: 10,
        tempo: 999,
        notation: 'sargam',
        haptics: 'yes',
        scale: 'toString',
      },
    }),
  );
  assert.deepEqual(decoded, { ...DEFAULT_PREFERENCES, notation: 'sargam' });
});
