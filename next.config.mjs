/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@terminal3/t3n-sdk"],
  },
};

export default nextConfig;
