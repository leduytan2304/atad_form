import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  agentRules: false,
  partialPrefetching: true,
  experimental: {
    // On WSL/Windows-mounted drives (/mnt/c) Turbopack's lockfile creation
    // fails with EACCES. Disabling the dev lockfile lets `next dev` start.
    lockDistDir: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
