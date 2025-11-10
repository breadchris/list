const esbuild = require('esbuild');
const path = require('path');

// Build configuration for sidebar React app
esbuild.build({
  entryPoints: ['sidebar.tsx'],
  bundle: true,
  outfile: 'sidebar.js',
  format: 'iife', // Immediately Invoked Function Expression for browser
  platform: 'browser',
  target: ['chrome114'], // Chrome 114+ for side panel API
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.js': 'js',
  },
  external: ['chrome'], // Chrome APIs are provided by the browser
  define: {
    'process.env.NODE_ENV': '"production"',
    'LAMBDA_ENDPOINT': '"http://localhost:3002/lambda-proxy"', // Default for local dev
  },
  minify: true,
  sourcemap: true,
  jsx: 'automatic', // Use React 17+ automatic JSX transform
}).then(() => {
  console.log('✅ Sidebar bundle built successfully');
  console.log('📦 Output: extension/sidebar.js');
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
