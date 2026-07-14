import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/brand/'],
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: 'https://codexhange.com/sitemap.xml',
  };
}
