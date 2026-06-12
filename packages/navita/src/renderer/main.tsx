import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// @ts-expect-error esbuild loads .css as text via loader config
import globalCss from './styles/global.css';

const style = document.createElement('style');
style.textContent = globalCss as string;
document.head.appendChild(style);

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
}
