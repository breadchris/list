// Main List App Entry Point
// Self-contained application with DOM rendering logic

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ListApp } from './components/ListApp';

// Auto-render application when module loads (for production builds)
if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    console.log('🚀 Initializing List App...');
    
    try {
      const root = createRoot(rootElement);
      root.render(<ListApp />);
      console.log('✅ List App rendered successfully!');
    } catch (error) {
      console.error('❌ Failed to render List App:', error);
      
      rootElement.innerHTML = `
        <div style="padding: 20px; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; margin: 20px; border-radius: 8px; font-family: monospace;">
          <h3>🚨 Error Loading List App</h3>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <pre>${error instanceof Error && error.stack ? error.stack : ''}</pre>
          <h4>🔧 Troubleshooting:</h4>
          <ul>
            <li>Check that all components are properly exported</li>
            <li>Verify Supabase configuration</li>
            <li>Check browser console for additional error details</li>
            <li>Try rebuilding the application</li>
          </ul>
        </div>
      `;
    }
  }
}

// Export for module usage
export { ListApp };