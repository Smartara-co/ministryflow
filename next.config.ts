import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // A stray lockfile in the user profile directory otherwise makes Next
    // infer the wrong workspace root.
    root: path.join(__dirname),
  },
  experimental: {
    serverActions: {
      // Document uploads (uploadDocument) go through a Server Action and
      // are validated up to 5MB (MAX_FILE_SIZE_BYTES in lib/documents.ts).
      // Next's default 1MB Server Action body limit silently broke every
      // upload over that size — real scanned documents routinely run
      // 1.6–4.9MB. 6mb leaves headroom for multipart/form-data overhead
      // above the 5MB file cap.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
