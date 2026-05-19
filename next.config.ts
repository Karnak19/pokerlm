import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable the Cache Components feature so server functions/components
  // can use the "use cache" directive for fine-grained caching.
  cacheComponents: true,
};

export default nextConfig;
