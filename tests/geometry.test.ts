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

test('note taps follow the rotated outer ring at every pitch and size', () => {
  for (const size of [260, 320, 400, 500]) {
    for (const steps of [-25, -12, -1, 0, 1, 7, 12, 25]) {
      const rotation = (steps + 0.3) * SEMITONE_ANGLE;
      for (let pitch = 0; pitch < 12; pitch++) {
        for (const radius of [0.285, 0.404]) {
          const point = pointOnWheel(pitch + steps + 0.3, size * radius, size / 2);
          assert.equal(pitchAtPoint(point.x, point.y, size, rotation), pitch);
        }
      }
      assert.equal(pitchAtPoint(size / 2, size / 2, size, rotation), null);
      assert.equal(pitchAtPoint(0, 0, size, rotation), null);
    }
  }
});

test('crossing the angle boundary causes a small rotation', () => {
  assert.ok(Math.abs(shortestAngle(-Math.PI * 1.98) - Math.PI * 0.02) < 1e-10);
  assert.ok(Math.abs(shortestAngle(FULL_TURN + 0.1) - 0.1) < 1e-10);
});
