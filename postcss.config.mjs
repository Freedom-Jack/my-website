// No PostCSS plugins: the CSS is written for current browsers, and Next.js (Lightning CSS) handles the rest.
// This file also stops PostCSS from searching parent folders for someone else's config.
const config = { plugins: {} };

export default config;
