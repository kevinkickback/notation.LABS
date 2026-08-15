import { afterEach, beforeEach, vi } from 'vitest';

// jest-dom matchers removed; using only Vitest and Testing Library

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    throw new Error(`Unexpected console.error: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: unknown, ...args: unknown[]) => {
  const message =
    typeof warning === 'string'
      ? warning
      : warning instanceof Error
        ? warning.message
        : '';

  if (
    message.includes('`--localstorage-file` was provided without a valid path')
  ) {
    return;
  }

  return originalEmitWarning(
    warning as Parameters<typeof process.emitWarning>[0],
    ...(args as Parameters<typeof process.emitWarning> extends [
      unknown,
      ...infer Rest,
    ]
      ? Rest
      : never),
  );
}) as typeof process.emitWarning;

// Polyfill ResizeObserver for jsdom (used by Radix UI components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill window.matchMedia for jsdom (used by useIsMobile hook)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
