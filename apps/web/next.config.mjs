/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@agenomy/shared", "@agenomy/runtime", "@agenomy/invoker"],
};

export default nextConfig;
