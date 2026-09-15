import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BackendConnectionGate } from './components/BackendConnectionGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BackendConnectionGate />
    <App />
  </React.StrictMode>
);
