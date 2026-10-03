import JSDOMEnvironment from 'jest-environment-jsdom';

/**
 * Web platform globals every supported browser has but jsdom does not implement.
 * Node's implementations are spec-compliant, so tests use those.
 */
const MISSING_GLOBALS = [
  'structuredClone',
  'TextEncoder',
  'TextDecoder',
  'fetch',
  'Request',
  'Response',
  'Headers',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
];

/**
 * Globals jsdom does implement but which must come from Node anyway: Node's `Request`
 * rejects jsdom's `AbortSignal`, which breaks routers that create requests per navigation.
 */
const REPLACED_GLOBALS = ['AbortController', 'AbortSignal'];

/** jsdom test environment with the missing web platform globals filled in from Node. */
export default class Environment extends JSDOMEnvironment {
  /** @param {ConstructorParameters<typeof JSDOMEnvironment>} args */
  constructor(...args) {
    super(...args);

    for (const name of [...MISSING_GLOBALS, ...REPLACED_GLOBALS]) {
      if (REPLACED_GLOBALS.includes(name) || !(name in this.global)) {
        Object.defineProperty(this.global, name, {
          value: /** @type {Record<string, unknown>} */ (globalThis)[name],
          writable: true,
          configurable: true,
        });
      }
    }
  }
}
