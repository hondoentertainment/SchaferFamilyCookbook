import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { UIProvider } from './context/UIContext';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <UIProvider>
        <App />
    </UIProvider>
);
