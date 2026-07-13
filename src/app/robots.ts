import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/brand/', '/auth/login', '/auth/register'],
        disallow: ['/api/', '/dashboard/', '/_next/'],
      },
    ],
    sitemap: 'https://codexhange.com/sitemap.xml',
  };
}
