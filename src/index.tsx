import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { UIProvider } from './context/UIContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './monitoring/sentry';
import { bootstrapFirebaseFromEnv } from './utils/bootstrapFirebaseFromEnv';
import { initializeTheme } from './utils/theme';

initSentry();
bootstrapFirebaseFromEnv();
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
