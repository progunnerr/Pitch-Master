import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_TURN,
  pitchAtPoint,
  pointOnWheel,
  SEMITONE_ANGLE,
  shortestAngle,
  snappedTonic,
} from '../src/features/wheel/geometry.ts';

test('every outer note has the correct hit target at multiple sizes', () => {
  for (const size of [260, 320, 400, 500]) {
    for (let pitch = 0; pitch < 12; pitch++) {
      const point = pointOnWheel(pitch, size * 0.41, size / 2);
      assert.equal(pitchAtPoint(point.x, point.y, size), pitch);
    }
    assert.equal(pitchAtPoint(size / 2, size / 2, size), null);
    assert.equal(pitchAtPoint(0, 0, size), null);
  }
});

test('snaps all positions and multiple turns in either direction', () => {
  for (let step = -48; step <= 48; step++) {
    assert.equal(
      snappedTonic(step * SEMITONE_ANGLE + SEMITONE_ANGLE * 0.2),
      ((step % 12) + 12) % 12,
    );
  }
  assert.equal(snappedTonic(-SEMITONE_ANGLE), 11);
});

test('crossing the angle boundary causes a small rotation', () => {
  assert.ok(Math.abs(shortestAngle(-Math.PI * 1.98) - Math.PI * 0.02) < 1e-10);
  assert.ok(Math.abs(shortestAngle(FULL_TURN + 0.1) - 0.1) < 1e-10);
});
