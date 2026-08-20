import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { SettingsProvider } from '@/context/SettingsContext';
import { UpdaterProvider } from '@/context/UpdaterContext';

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
      <SettingsProvider>
        <UpdaterProvider>
          <App />
        </UpdaterProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
);
