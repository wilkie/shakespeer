const { readFileSync } = require('node:fs');

const { transformSync } = require('@babel/core');
const swcJest = require('@swc/jest');

/**
 * Jest transform for React packages: the React Compiler (the Babel plugin Vite runs, see
 * apps/web/vite.config.ts), then SWC. Tests then run the memoized components that ship;
 * without it, every state change re-renders whole trees and tests behave unlike the app.
 */
// Cached output must change when this transform does.
const SALT = `react-compiler\0${readFileSync(__filename, 'utf8')}\0`;

module.exports = {
  createTransformer(swcOptions) {
    const swc = swcJest.createTransformer(swcOptions);
    const compile = (source, filename) =>
      transformSync(source, {
        filename,
        babelrc: false,
        configFile: false,
        // Parse TypeScript and JSX but leave them for SWC; only the compiler transforms.
        parserOpts: { plugins: ['jsx', 'typescript'] },
        plugins: [['babel-plugin-react-compiler', {}]],
        sourceMaps: false,
      })?.code ?? source;
    return {
      ...swc,
      process: (source, filename, options) =>
        swc.process(compile(source, filename), filename, options),
      processAsync: (source, filename, options) =>
        swc.processAsync(compile(source, filename), filename, options),
      getCacheKey: (source, filename, options) => swc.getCacheKey(SALT + source, filename, options),
    };
  },
};
