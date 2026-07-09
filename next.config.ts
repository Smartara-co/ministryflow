import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // A stray lockfile in the user profile directory otherwise makes Next
    // infer the wrong workspace root.
    root: path.join(__dirname),
  },
};

export default nextConfig;
