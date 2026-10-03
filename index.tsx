import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const showFatalError = (error: unknown, title = 'NILE FLEET CORE ERROR') => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(title, error);
  rootElement.innerHTML = `
    <div style="padding:32px;font-family:Inter,Arial,sans-serif;text-align:center;background:#07111f;color:#fff;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;box-sizing:border-box">
      <img src="/nile-fleet-logo.png" style="height:72px;width:72px;object-fit:contain;margin-bottom:18px" alt="Nile Fleet">
      <h1 style="color:#c2a378;margin:0 0 12px;font-size:22px">NILE FLEET</h1>
      <p style="margin:0 0 16px;color:#d1dbe5">The application could not start.</p>
      <pre style="background:#0d1928;border:1px solid #34485d;color:#fff;padding:16px;border-radius:10px;font-size:12px;max-width:90%;overflow:auto;white-space:pre-wrap;text-align:left">${message.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>
      <button onclick="window.location.reload()" style="margin-top:18px;padding:11px 20px;background:#c2a378;border:0;border-radius:7px;cursor:pointer;font-weight:800;color:#07111f">RELOAD SYSTEM</button>
    </div>
  `;
};

window.addEventListener('error', event => {
  if (event.error || /module|import|chunk/i.test(event.message || '')) {
    showFatalError(event.error || event.message, 'NILE FLEET RUNTIME ERROR');
  }
});

window.addEventListener('unhandledrejection', event => {
  showFatalError(event.reason, 'NILE FLEET MODULE ERROR');
});

rootElement.innerHTML = `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07111f;color:#c2a378;font:700 12px Inter,Arial,sans-serif;letter-spacing:.18em">
    NILE FLEET
  </div>
`;

import('./App')
  .then(({ default: App }) => {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch(error => showFatalError(error, 'NILE FLEET MODULE LOAD ERROR'));
