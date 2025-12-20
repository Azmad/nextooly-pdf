import type { NextConfig } from "next";
import webpack from "webpack";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // --- ADD THIS BLOCK FOR MUPDF SUPPORT ---
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,      // Fixes the "topLevelAwait" error
      asyncWebAssembly: true,   // Ensures WASM modules load correctly
      layers: true,             // formatting/layering support
    };
    // ----------------------------------------

    if (!isServer) {
      // 1. Fallback: Resolve these modules to "empty" (false)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        module: false,
        process: false,
        buffer: false,
      };

      // 2. Plugin: Strip "node:" prefix
      // This rewrites "node:fs" -> "fs", "node:path" -> "path", etc.
      // Then the fallbacks above take over.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: any) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );
    }
    return config;
  },
};

export default nextConfig;