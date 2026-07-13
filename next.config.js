/** @type {import('next').NextConfig} */
function getHeaders() {
  if (process.env.NODE_ENV !== 'production') return [];
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' ws: wss: https:",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
          ].join('; '),
        },
      ],
    },
  ];
}

const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['185.70.187.114'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return getHeaders();
  },
};

export default nextConfig;
