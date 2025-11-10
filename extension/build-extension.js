import esbuild from 'esbuild';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for watch mode
const watchMode = process.argv.includes('--watch');

// Shared build configuration
const sharedConfig = {
  bundle: true,
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
  minify: !watchMode, // Don't minify in watch mode for faster builds
  sourcemap: true,
  jsx: 'automatic', // Use React 17+ automatic JSX transform
};

// Build configurations for both entry points
const buildConfigs = [
  {
    ...sharedConfig,
    entryPoints: ['background.ts'],
    outfile: 'background.js',
  },
  {
    ...sharedConfig,
    entryPoints: ['sidebar.tsx'],
    outfile: 'sidebar.js',
  },
];

// Compile Tailwind CSS
async function compileCss() {
  return new Promise((resolve, reject) => {
    console.log('🎨 Compiling Tailwind CSS...');

    const args = [
      '@tailwindcss/cli',
      '-i', './input.css',
      '-o', './styles.css',
      '--minify'
    ];

    if (watchMode) {
      args.push('--watch');
    }

    const tailwind = spawn('npx', args, {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    if (watchMode) {
      // In watch mode, don't wait for process to exit
      console.log('👀 Watching CSS for changes...');
      resolve();
    } else {
      tailwind.on('close', (code) => {
        if (code === 0) {
          console.log('✅ CSS compiled successfully\n');
          resolve();
        } else {
          reject(new Error(`Tailwind CSS compilation failed with code ${code}`));
        }
      });
    }
  });
}

// Build function
async function build() {
  try {
    console.log('🔨 Building Chrome extension...\n');

    // Step 1: Compile CSS (unless in watch mode, where it runs in parallel)
    if (!watchMode) {
      await compileCss();
    } else {
      // Start CSS watch in background
      compileCss().catch(err => console.error('CSS compilation error:', err));
    }

    // Step 2: Build JavaScript files
    for (const config of buildConfigs) {
      const filename = path.basename(config.outfile);
      const entrypoint = path.basename(config.entryPoints[0]);

      if (watchMode) {
        console.log(`👀 Watching ${entrypoint} → ${filename}...`);
        const context = await esbuild.context(config);
        await context.watch();
      } else {
        console.log(`📦 Building ${entrypoint} → ${filename}...`);
        await esbuild.build(config);
        console.log(`✅ ${filename} built successfully`);
      }
    }

    if (watchMode) {
      console.log('\n👀 Watching for changes... (Press Ctrl+C to stop)');
    } else {
      console.log('\n✅ Extension build complete!');
      console.log('📂 Output directory: extension/');
      console.log('   - styles.css (from input.css)');
      console.log('   - background.js (from background.ts)');
      console.log('   - sidebar.js (from sidebar.tsx)');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();
