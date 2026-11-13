// glsl-loader.cjs — a webpack-style loader (Turbopack `rules`, next.config.ts) for the engine's shader module,
// src/features/landscape/engine/shaders.ts: the GLSL inside its template literals loses its comments and indentation
// in the bundle, so the source stays readable while the engine's chunk is about 35 KB (gzip) lighter. Only text
// inside backticks changes; a line that holds a `${…}` interpolation is left whole (trimmed only); preprocessor lines
// keep their own line. The compiled programs are the same tokens, so the painting is the same pixels.
// (CommonJS: Turbopack runs loaders through webpack's loader-runner.)

/** The GLSL of one template literal without its `//` comments, leading or trailing blanks, or empty lines. */
function strip(glsl) {
  const out = [];
  for (const raw of glsl.split('\n')) {
    let line = raw;
    // (a line with an interpolation may carry anything JavaScript inside ${…}: it is only trimmed)
    if (!line.includes('${')) {
      const i = line.indexOf('//');
      if (i >= 0) line = line.slice(0, i);
    }
    line = line.trim();
    if (line) out.push(line);
  }
  return out.join('\n');
}

/** The module's source with every template literal's GLSL stripped. (A literal's body may hold escaped characters,
 *  a comment's \`word\` among them: the match steps over any escaped character, never ending a literal at one.) */
function transform(source) {
  return source.replace(/`((?:\\[\s\S]|[^`\\])*)`/g, (m, body) => `\`${strip(body)}\``);
}

module.exports = function glslLoader(source) {
  return transform(String(source));
};
module.exports.strip = strip;
module.exports.transform = transform;
