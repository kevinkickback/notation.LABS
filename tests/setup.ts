import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver for jsdom (used by Radix UI components)
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};
