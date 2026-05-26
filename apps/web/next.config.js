const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  typedRoutes: false,
  reactStrictMode: false,
  serverExternalPackages: ["ioredis"],
  experimental: {
    trustHostHeader: true
  }
};

module.exports = nextConfig;
