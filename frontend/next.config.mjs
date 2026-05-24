/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@splinetool/react-spline', '@splinetool/runtime'],
  webpack: (config) => {
    // Tell Webpack to completely ignore exports fields inside package.json files
    config.resolve.exportsFields = [];
    return config;
  },
};

export default nextConfig;
