import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';
import Category from '@/lib/models/Category';
import Brand from '@/lib/models/Brand';
import Service from '@/lib/models/Service';
import Website from '@/lib/models/Website';
import ScanJob from '@/lib/models/ScanJob';
import { allBrands } from '@/lib/data/brands';

const SCAN_PATTERNS = ['/coupons', '/promo', '/promo-codes', '/discount', '/deals', '/offers', '/sale'];

export const dynamic = 'force-dynamic';

export async function POST() {
  await connectDB();

  const categoryCache = new Map<string, string>();

  const getOrCreateCategory = async (raw: string): Promise<string> => {
    if (categoryCache.has(raw)) return categoryCache.get(raw)!;
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let cat = await Category.findOne({ slug });
    if (!cat) {
      cat = await Category.create({ name: raw, slug, order: 0 });
    }
    categoryCache.set(raw, cat._id.toString());
    return cat._id.toString();
  };

  let brandsCreated = 0;
  let brandsSkipped = 0;
  let servicesCreated = 0;
  let websitesCreated = 0;
  let scanJobsCreated = 0;

  for (const entry of allBrands) {
    const catId = await getOrCreateCategory(entry.category);
    const slug = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    let brand = await Brand.findOne({ slug });
    if (!brand) {
      brand = await Brand.create({
        name: entry.name,
        slug,
        website: entry.website,
        categories: [catId],
        hasPromoCodes: true,
        hasReferralProgram: entry.hasReferralProgram,
        country: 'US',
        discounts: {
          firstYear: true, transfer: true, renewal: false, bundle: true,
          sslBundle: false, emailHosting: false, student: false,
          blackFriday: true, cyberMonday: true, newYear: true, anniversary: false, flashSale: true,
        },
        extensions: ['.com', '.net', '.org', '.ai', '.io', '.dev', '.app', '.xyz', '.co', '.me'],
        discovery: { enabled: true, crawlDelay: 3000, crawlDepth: 2, allowGoogleSearch: false, allowSitemap: true, allowReferral: true },
      });
      brandsCreated++;
    } else {
      if (!brand.categories?.includes(catId as any)) {
        brand.categories.push(catId as any);
        await brand.save();
      }
      brandsSkipped++;
    }

    const serviceSlug = 'general';
    const existing = await Service.findOne({ brandId: brand._id, slug: serviceSlug });
    if (!existing) {
      await Service.create({
        name: `${entry.name} Offers`,
        slug: serviceSlug,
        brandId: brand._id,
        categoryId: catId,
        description: `Promo codes, coupons and offers for ${entry.name}`,
      });
      servicesCreated++;
    }

    const website = await Website.findOne({ 'brand.slug': slug });
    if (!website && entry.website) {
      let domain = '';
      try {
        domain = new URL(entry.website).hostname.replace(/^www\./, '');
      } catch {
        domain = entry.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      }
      await Website.create({
        url: entry.website,
        domain,
        brand: { name: entry.name, slug, category: entry.category },
        status: 'active',
        settings: { scan_frequency: 12, crawl_depth: 2, javascript: false, auto_publish: false, ai_enabled: false },
        stats: { offers_found: 0, offers_published: 0, blocked_count: 0, success_rate: 0, health_score: 100 },
      });
      websitesCreated++;
    }
  }

  const totalBrands = await Brand.countDocuments({});
  const totalServices = await Service.countDocuments({});
  const totalCategories = await Category.countDocuments({});
  const totalWebsites = await Website.countDocuments({});

  return NextResponse.json({
    brandsCreated,
    brandsSkipped,
    servicesCreated,
    websitesCreated,
    scanJobsCreated,
    totalBrands,
    totalServices,
    totalCategories,
    totalWebsites,
  });
}
