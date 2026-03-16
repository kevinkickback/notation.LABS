import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App.tsx';
import { ErrorFallback } from './ErrorFallback.tsx';
import { resetDatabase } from '../scripts/reset-db';

// CSS: main.css is the single entry point (imports theme.css and index.css)
import './main.css';

// When launched with VITE_RESET_DB=true, wipe IndexedDB before mounting
if (import.meta.env.VITE_RESET_DB === 'true') {
	await resetDatabase();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error(
		'Root element #root not found. Ensure index.html contains <div id="root"></div>.',
	);
}

createRoot(rootElement).render(
	<StrictMode>
		<ErrorBoundary FallbackComponent={ErrorFallback}>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);
