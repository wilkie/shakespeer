import '@testing-library/jest-dom/jest-globals';

import { afterEach, jest } from '@jest/globals';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia; MUI's color-scheme handling relies on it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// jsdom has no layout, so ranges have no geometry; give them an on-screen box.
const rect = () => new DOMRect(100, 300, 50, 20);
Object.assign(Range.prototype, {
  getBoundingClientRect: rect,
  getClientRects: () => [rect()],
});
