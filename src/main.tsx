import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './auth/AuthProvider';
import { AuthGate } from './auth/AuthGate';

const el = document.getElementById('root');
if (!el) throw new Error('Root element #root not found');

ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
