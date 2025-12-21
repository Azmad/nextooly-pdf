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
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    path: false,
    crypto: false,
    module: false,
    process: false,
    buffer: false,
  };

  config.plugins = config.plugins || []; // ADD THIS (safety)
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: any) => {
      resource.request = resource.request.replace(/^node:/, "");
    })
  );
}

    return config;
  },
};

export default nextConfig;