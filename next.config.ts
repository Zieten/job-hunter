import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the watch root to this project folder only.
    // Without this, Next.js walks up to C:\Users\valer (because of a stray
    // pnpm-lock.yaml there) and watches the entire user profile — CPU/RAM disaster.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
