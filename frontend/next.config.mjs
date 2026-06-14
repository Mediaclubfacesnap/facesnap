/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ['@splinetool/react-spline', '@splinetool/runtime'],
  webpack: (config) => {
    // Tell Webpack to completely ignore exports fields inside package.json files
    config.resolve.exportsFields = [];
    return config;
  },
};

import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  sw: "worker/index.ts",  // Custom service worker with push logic
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  }
});

export default withPWA(nextConfig);
