import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../auth/AuthProvider';
import { AuthGate } from '../auth/AuthGate';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>
);
