import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
import * as model from '../src/features/guitar/model.ts';
import * as metronome from '../src/features/guitar/metronome.ts';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactNode) => string;
};

// Render the actual strip with lightweight native element adapters. This catches
// visible count labels, while leaving strumming actions and saved patterns intact.
const module = {
  exports: {} as Record<
    string,
    React.ComponentType<{ pattern: model.StrumPattern; subdivision?: number }>
  >,
};
const source = ts.transpileModule(
  readFileSync(new URL('../src/features/guitar/PatternEditor.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
function Box({
  children,
  accessibilityLabel,
}: {
  children?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  return React.createElement('div', { 'aria-label': accessibilityLabel }, children);
}
runInNewContext(source, {
  exports: module.exports,
  module,
  require(name: string) {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return jsx;
    if (name === 'react-native') return { Text: Box, View: Box, ScrollView: Box };
    if (name === './model') return model;
    if (name === './metronome') return metronome;
    if (name === './StudioShared') return { s: {} };
    if (name === '../../components/Controls') return {};
    throw new Error(name);
  },
});
const Strip = module.exports.PatternStrip!;

test('Daily Strumming Practice shows only whole beats when Quarter is selected, including saved routines', () => {
  const routine = JSON.parse(JSON.stringify(model.defaultRoutine())) as model.PracticeRoutine;
  for (const block of routine.blocks) {
    assert.equal(
      block.pattern.subdivision,
      2,
      'the existing saved pattern can retain its editing grid',
    );
    const html = renderToStaticMarkup(
      React.createElement(Strip, { pattern: block.pattern, subdivision: 1 }),
    );
    assert.doesNotMatch(html, /&amp;/);
    for (const count of ['1', '2', '3', '4']) assert.ok(html.includes(`>${count}</div>`));
    assert.match(html, /quarter/);
    assert.doesNotMatch(html, /eighth/);
  }
});

test('Eighth and Sixteenth opt into their corresponding visible count labels', () => {
  const pattern = model.defaultRoutine().blocks[0]!.pattern;
  const eighth = renderToStaticMarkup(React.createElement(Strip, { pattern, subdivision: 2 }));
  const sixteenth = renderToStaticMarkup(React.createElement(Strip, { pattern, subdivision: 4 }));
  assert.equal((eighth.match(/>&amp;<\/div>/g) ?? []).length, 4);
  assert.doesNotMatch(eighth, />e<\/div>/);
  assert.equal((sixteenth.match(/>e<\/div>/g) ?? []).length, 4);
  assert.equal((sixteenth.match(/>&amp;<\/div>/g) ?? []).length, 4);
  assert.equal((sixteenth.match(/>a<\/div>/g) ?? []).length, 4);
});

test('hiding subdivision counts preserves custom offbeat strums and exact action timing', () => {
  const pattern = model.copy(model.defaultRoutine().blocks[0]!.pattern);
  pattern.events[1]!.beat = 0.5;
  const before = JSON.stringify(pattern);
  const html = renderToStaticMarkup(React.createElement(Strip, { pattern, subdivision: 1 }));
  assert.doesNotMatch(html, /&amp;/);
  assert.match(html, /Between counts: Up/);
  assert.equal(
    model.patternTimeline(pattern, 1).find((s) => s.beat === 0.5)!.events[0]!.action,
    'up',
  );
  assert.equal(JSON.stringify(pattern), before);
});
