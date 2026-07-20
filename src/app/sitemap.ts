import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Offer from '@/lib/models/Offer';
import Category from '@/lib/models/Category';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://codexhange.com';

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    await connectDB();

    // Brands with offers — these are the important SEO pages
    const offerBrands = await Offer.distinct('store_name', { status: 'published' });
    const brandSlugs = [...new Set(offerBrands.map(b => b.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '')))];

    const brandPages: MetadataRoute.Sitemap = brandSlugs.map((slug) => ({
      url: `${baseUrl}/brand/${encodeURIComponent(slug)}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }));

    // All brands from DB as well
    const dbBrands = await Brand.find({ active: true }).select('slug').lean();
    for (const b of (dbBrands as any[])) {
      if (!brandSlugs.includes(b.slug)) {
        brandPages.push({
          url: `${baseUrl}/brand/${encodeURIComponent(b.slug)}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        });
      }
    }

    // Category pages
    const categories = await Category.find({ active: true }).select('slug').lean();
    const categoryPages: MetadataRoute.Sitemap = (categories as any[]).map((c) => ({
      url: `${baseUrl}/category/${encodeURIComponent(c.slug)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    return [...staticPages, ...brandPages, ...categoryPages];
  } catch {
    return staticPages;
  }
}
