import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || "dev",
  },
};

export default nextConfig;
