
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global listener for module load errors (common in Netlify/GitHub deploys)
window.addEventListener('error', (event) => {
  if (event.message.includes('module') || event.message.includes('import')) {
    rootElement.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; text-align: center; background: #001F3F; color: white; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="color: #C2A378;">DEPLOYMENT PATH ERROR</h1>
        <p>The terminal failed to resolve module dependencies.</p>
        <p style="font-size: 11px; opacity: 0.7;">This usually happens if the build tool or server cannot find the TSX files.</p>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #C2A378; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; color: #001F3F;">RETRY CONNECTION</button>
      </div>
    `;
  }
});

const root = ReactDOM.createRoot(rootElement);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical Application Failure:", error);
  rootElement.innerHTML = `
    <div style="padding: 40px; font-family: sans-serif; text-align: center; background: #001F3F; color: white; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1 style="color: #C2A378;">NILE FLEET CORE ERROR</h1>
      <p>The application encountered a runtime initialization error.</p>
      <pre style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px; font-size: 12px; margin-top: 20px; max-width: 80%; overflow: auto;">${error}</pre>
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #C2A378; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; color: #001F3F;">Restart System</button>
    </div>
  `;
}