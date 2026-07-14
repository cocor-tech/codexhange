import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://codexhange.com';

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    await connectDB();
    const brands = await Code.distinct('brandSlug', { archived: false });

    const brandPages: MetadataRoute.Sitemap = brands.map((slug) => ({
      url: `${baseUrl}/brand/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }));

    return [...staticPages, ...brandPages];
  } catch {
    return staticPages;
  }
}
