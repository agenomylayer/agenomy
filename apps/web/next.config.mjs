/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@agenomy/shared", "@agenomy/runtime"],
};

export default nextConfig;
