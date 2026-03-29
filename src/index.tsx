import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { UIProvider } from './context/UIContext';
import { OfflineBanner } from './components/OfflineBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './monitoring/sentry';

initSentry();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <ErrorBoundary>
        <UIProvider>
            <OfflineBanner />
            <App />
        </UIProvider>
    </ErrorBoundary>
);
