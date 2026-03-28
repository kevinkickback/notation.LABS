// jest-dom matchers removed; using only Vitest and Testing Library

// Polyfill ResizeObserver for jsdom (used by Radix UI components)
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};
