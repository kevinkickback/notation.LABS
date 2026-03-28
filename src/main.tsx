import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App.tsx';
import { ErrorFallback } from './ErrorFallback.tsx';
import './main.css';

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
