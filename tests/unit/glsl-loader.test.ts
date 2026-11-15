// The shader loader (tools/glsl-loader.cjs, run by Turbopack on engine/shaders.ts): it drops the GLSL's comments and
// indentation and nothing else: every preprocessor line keeps its own line, every `${…}` interpolation is left whole,
// and text outside the template literals is untouched. The real module stays well formed through it.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const loader = require('../../tools/glsl-loader.cjs') as {
  (source: string): string;
  strip(glsl: string): string;
  transform(source: string): string;
};

describe('the GLSL loader', () => {
  it('strips comments and indentation, keeps preprocessor lines and interpolations', () => {
    const src = [
      '#version 300 es',
      '  // a comment line',
      '#define L ${LAYERS}   // kept whole: an interpolation',
      '  float x = 1.0; // trailing',
      '',
      '  const float N = ${NOISE_SIZE}.0;',
      '  if (a) { // open',
      '    b = c;',
      '  }',
    ].join('\n');
    expect(loader.strip(src)).toBe(
      [
        '#version 300 es',
        '#define L ${LAYERS}   // kept whole: an interpolation',
        'float x = 1.0;',
        'const float N = ${NOISE_SIZE}.0;',
        'if (a) {',
        'b = c;',
        '}',
      ].join('\n'),
    );
  });
  it('touches only the template literals', () => {
    const src = "const A = 1; // js comment\nexport const S = `\n  // glsl\n  vec2 p; // x\n`;\nconst B = 'x // y';";
    expect(loader.transform(src)).toBe("const A = 1; // js comment\nexport const S = `vec2 p;`;\nconst B = 'x // y';");
    expect(loader(src)).toBe(loader.transform(src));
  });
  it('steps over an escaped backtick inside a literal (a comment naming a `word`)', () => {
    const src = 'const S = `\n  ${HASH}   // \\`per\\` cells\n  float x; // a\n`;\nconst T = `b`;';
    expect(loader.transform(src)).toBe('const S = `${HASH}   // \\`per\\` cells\nfloat x;`;\nconst T = `b`;');
  });
  it('keeps the engine’s shader module well formed and every interpolation', () => {
    const file = path.join(import.meta.dirname, '../../src/features/landscape/engine/shaders.ts');
    const src = readFileSync(file, 'utf8');
    const out = loader.transform(src);
    const ticks = (s: string) => (s.match(/(?<!\\)`/g) || []).length; // (an escaped one is a comment's, and may go)
    const holes = (s: string) => (s.match(/\$\{/g) || []).length;
    const pre = (s: string) => (s.match(/^\s*#/gm) || []).length;
    expect(ticks(out)).toBe(ticks(src));
    expect(holes(out)).toBe(holes(src));
    expect(pre(out)).toBe(pre(src));
    expect(out.length).toBeLessThan(src.length * 0.6);
    expect(loader.transform(out)).toBe(out); // idempotent
    // the bundler must still parse it: the literals paired as before, every escape intact
    expect(() => transformSync(out, { loader: 'ts', format: 'esm' })).not.toThrow();
    expect(() => transformSync(src, { loader: 'ts', format: 'esm' })).not.toThrow();
  });
});
