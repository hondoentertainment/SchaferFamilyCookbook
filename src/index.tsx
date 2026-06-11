import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { UIProvider } from './context/UIContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './monitoring/sentry';
import { initWebVitals } from './monitoring/webVitals';
import { initializeTheme } from './utils/theme';

initSentry();
initWebVitals();
initializeTheme();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <ErrorBoundary>
        <UIProvider>
            <App />
        </UIProvider>
    </ErrorBoundary>
);
