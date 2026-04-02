// jest-dom matchers removed; using only Vitest and Testing Library

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
