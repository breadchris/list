import React from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from './components/Sidebar';

// Mount React app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Sidebar />
    </React.StrictMode>
  );
}
