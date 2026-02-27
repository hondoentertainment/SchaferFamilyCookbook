import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { UIProvider } from './context/UIContext';
import { OfflineBanner } from './components/OfflineBanner';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <UIProvider>
        <OfflineBanner />
        <App />
    </UIProvider>
);
