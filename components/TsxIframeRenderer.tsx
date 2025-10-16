/**
 * TSX Iframe Renderer Component
 *
 * Renders TSX components in isolated iframes for security and style isolation.
 * Features auto-sizing, scrolling, fullscreen mode, error handling, and proper cleanup.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TsxIframeRendererProps {
  compiledJS: string;
  filename?: string;
  componentProps?: Record<string, any>;
  onError?: (error: Error) => void;
  onLoad?: () => void;
  minHeight?: number;
  maxHeight?: number;
}

interface IframeMessage {
  type: 'ready' | 'height' | 'error';
  height?: number;
  error?: string;
}

/**
 * TsxIframeRenderer - Renders transpiled TSX in an isolated iframe
 */
export function TsxIframeRenderer({
  compiledJS,
  filename = 'component.tsx',
  componentProps = {},
  onError,
  onLoad,
  minHeight = 100,
  maxHeight = 2000
}: TsxIframeRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<IframeMessage>) => {
      // Security: verify message is from our iframe
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const message = event.data;

      switch (message.type) {
        case 'ready':
          setIsReady(true);
          onLoad?.();
          console.log(`TSX component ready: ${filename}`);
          break;

        case 'height':
          if (message.height) {
            const newHeight = Math.max(minHeight, Math.min(message.height, maxHeight));
            setHeight(newHeight);
          }
          break;

        case 'error':
          const err = new Error(message.error || 'Component rendering failed');
          setError(message.error || 'Unknown error');
          onError?.(err);
          console.error(`TSX component error in ${filename}:`, message.error);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [filename, onError, onLoad, minHeight, maxHeight]);

  // ESC key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Generate iframe srcdoc
  const srcdoc = generateIframeHTML(compiledJS, componentProps, filename);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">Component Error</h3>
        <p className="text-red-600 text-sm font-mono">{error}</p>
      </div>
    );
  }

  const iframeElement = (
    <>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-sm">Loading component...</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: isFullscreen ? '100vh' : `${height}px`,
          border: 'none',
          display: 'block',
          transition: isFullscreen ? 'none' : 'height 0.2s ease-out',
          opacity: isReady ? 1 : 0
        }}
        title={filename}
      />
    </>
  );

  // Fullscreen overlay using Portal
  if (isFullscreen) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsFullscreen(false);
          }
        }}
      >
        <div className="flex justify-end p-4">
          <button
            onClick={handleToggleFullscreen}
            className="text-white hover:text-gray-300 transition-colors"
            title="Exit fullscreen (ESC)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 relative">
          {iframeElement}
        </div>
      </div>,
      document.body
    );
  }

  // Regular card view
  return (
    <div className="relative">
      <button
        onClick={handleToggleFullscreen}
        className="absolute top-2 right-2 z-10 p-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-lg shadow-sm transition-all"
        title="Fullscreen"
      >
        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
      {iframeElement}
    </div>
  );
}

/**
 * Generate complete HTML document for iframe
 */
function generateIframeHTML(
  compiledJS: string,
  componentProps: Record<string, any>,
  filename: string
): string {
  const propsJSON = JSON.stringify(componentProps);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filename)}</title>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18",
      "react-dom": "https://esm.sh/react-dom@18",
      "react-dom/client": "https://esm.sh/react-dom@18/client",
      "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
      "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
    }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.5;
      overflow: auto;
    }
    #root {
      min-height: 50px;
    }
    /* Tailwind-like utilities for common styles */
    .p-4 { padding: 1rem; }
    .rounded { border-radius: 0.375rem; }
    .border { border: 1px solid #e5e7eb; }
    .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="module">
    // Error handler
    window.addEventListener('error', (event) => {
      window.parent.postMessage({
        type: 'error',
        error: event.error?.message || event.message || 'Unknown error'
      }, '*');
    });

    window.addEventListener('unhandledrejection', (event) => {
      window.parent.postMessage({
        type: 'error',
        error: event.reason?.message || String(event.reason) || 'Promise rejection'
      }, '*');
    });

    // Import dependencies
    import React from 'react';
    import { createRoot } from 'react-dom/client';

    // Component props from parent
    const componentProps = ${propsJSON};

    // Compiled component module as data URL
    const componentCode = ${JSON.stringify(compiledJS)};
    const blob = new Blob([componentCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    // Dynamically import and render component
    (async () => {
      try {
        const module = await import(blobUrl);
        const Component = module.default;

        if (!Component) {
          throw new Error('Component module must have a default export');
        }

        const root = createRoot(document.getElementById('root'));
        root.render(React.createElement(Component, componentProps));

        // Notify parent that component is ready
        window.parent.postMessage({ type: 'ready' }, '*');

        // Set up ResizeObserver to track height changes
        const resizeObserver = new ResizeObserver(() => {
          const height = document.documentElement.scrollHeight;
          window.parent.postMessage({ type: 'height', height }, '*');
        });

        resizeObserver.observe(document.body);

        // Initial height report
        setTimeout(() => {
          const height = document.documentElement.scrollHeight;
          window.parent.postMessage({ type: 'height', height }, '*');
        }, 100);

      } catch (error) {
        console.error('Failed to render component:', error);
        window.parent.postMessage({
          type: 'error',
          error: error.message || 'Failed to render component'
        }, '*');

        // Display error in iframe
        document.getElementById('root').innerHTML =
          '<div style="padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem;">' +
          '<h3 style="color: #991b1b; font-weight: 600; margin-bottom: 0.5rem;">Component Error</h3>' +
          '<p style="color: #dc2626; font-size: 0.875rem;">' +
          (error.message || 'Failed to render component') +
          '</p></div>';
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
