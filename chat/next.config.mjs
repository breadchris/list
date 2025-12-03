import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    // Deduplicate yjs and prosemirror to prevent duplicate import errors
    // - yjs: "Yjs was already imported" warning
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: path.resolve(__dirname, 'node_modules/yjs'),
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
