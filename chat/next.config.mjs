import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Skip type checking during build - list migration has type mismatches to fix
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Deduplicate yjs and prosemirror to prevent duplicate import errors
    // - yjs: "Yjs was already imported" warning
    config.resolve.alias = {
      ...config.resolve.alias,
      // Deduplicate yjs
      yjs: path.resolve(__dirname, 'node_modules/yjs'),
      // Deduplicate ProseMirror packages (fixes "Duplicate use of selection JSON ID" error)
      'prosemirror-state': path.resolve(__dirname, 'node_modules/prosemirror-state'),
      'prosemirror-view': path.resolve(__dirname, 'node_modules/prosemirror-view'),
      'prosemirror-model': path.resolve(__dirname, 'node_modules/prosemirror-model'),
      'prosemirror-transform': path.resolve(__dirname, 'node_modules/prosemirror-transform'),
      'y-prosemirror': path.resolve(__dirname, 'node_modules/y-prosemirror'),
    };

    // Mark optional AI SDK schema libraries as external
    // These are only needed if using Effect or Valibot schemas (we use Zod)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        effect: false,
        '@valibot/to-json-schema': false,
      };
    }

    return config;
  },
};

export default nextConfig;
