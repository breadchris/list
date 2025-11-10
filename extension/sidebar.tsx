import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidebarChat } from './components/SidebarChat';

// Mount React app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <SidebarChat />
    </React.StrictMode>
  );
}
