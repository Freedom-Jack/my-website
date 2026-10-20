// lights.ts — THE one table of each place's light (the engine's lightK0), shared by the shaders (lightsGLSL), the
// story-map stills tool (tools/build-stills.ts writes each still's sun position into public/scenes/manifest.json) and
// the footer's story map (StoryMap reads that position for its "you are here" warmth). Change a light here only.
//
// Per place k (stretch k): [u, y, r, w] = world x (stretches), scene height (0 = the scene's foot, y up), the glow's
// radius (viewport heights) and its strength (w > 0: a light with a heart and, on still water, a glitter column; w < 0:
// a sky glow only). No disc, no ring anywhere.
export type Light = readonly [u: number, y: number, r: number, w: number];

export const LIGHTS: readonly Light[] = [
  [0.724, 0.518, 0.155, 1.0], // Home: behind the host peak, low enough to clear the header
  [1.8, 0.5, 0.24, -0.45], // Work: a wide sky glow over the bridge and the town
  [2.85, 0.47, 0.11, 0.62], // Writing: a low moon glow over the lake, glittering in it
  [3.8, 0.4, 0.26, -0.42], // Résumé: a morning haze behind the terraced hill
  [4.8, 0.45, 0.22, 0.55], // Contact: a pale dawn over the crossing, a glint on the water (q3: .45 -> .55)
  [5.7, 0.7, 0.3, -0.35], // 404
];

/** The GLSL lightK0(k): the table above (k outside 0..5: none). */
export function lightsGLSL(): string {
  const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
  const rows = LIGHTS.map((L, k) => {
    const v = `vec4(${L.map(f).join(', ')})`;
    return k < LIGHTS.length - 1 ? `  if (k < ${k}.5) return ${v};` : `  return ${v};`;
  });
  return `vec4 lightK0(float k) {
  if (k < -0.5 || k > ${LIGHTS.length - 1}.5) return vec4(0.0, 0.0, 1.0, 0.0);
${rows.join('\n')}
}`;
}
