import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // הריפו מכיל גם את מערכת המשקפיים; ה-root של האפליקציה הזו הוא igud/ בלבד.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
