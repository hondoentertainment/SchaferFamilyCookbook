import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { UIProvider } from './context/UIContext';
import { OfflineBanner } from './components/OfflineBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './monitoring/sentry';
import { reportWebVitals } from './utils/performance';

initSentry();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <ErrorBoundary>
        <BrowserRouter>
            <UIProvider>
                <OfflineBanner />
                <App />
            </UIProvider>
        </BrowserRouter>
    </ErrorBoundary>
);

reportWebVitals();
