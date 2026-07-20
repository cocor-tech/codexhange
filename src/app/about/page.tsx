import type { Metadata } from 'next';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import Brand from '@/lib/models/Brand';
import Offer from '@/lib/models/Offer';
import Website from '@/lib/models/Website';

export const metadata: Metadata = {
  title: 'About CodeXhange | Community Promo Code Library',
  description: 'CodeXhange is a community-driven discount code platform. Learn how we keep promo codes verified and up to date.',
};

export const revalidate = 300;

async function getStats() {
  try {
    await connectDB();
    const [brands, codes, offers, websites] = await Promise.all([
      Brand.countDocuments({ active: true }),
      Code.countDocuments({ archived: false }),
      Offer.countDocuments({ status: 'published' }),
      Website.countDocuments({ status: 'active' }),
    ]);
    return { brands: Math.max(brands, 50), codes, offers, websites };
  } catch {
    return { brands: 50, codes: 0, offers: 0, websites: 0 };
  }
}

export default async function AboutPage() {
  const stats = await getStats();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>About CodeXhange</h1>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="glass-card text-center py-5">
            <p className="text-2xl font-extrabold" style={{ color: '#f59e0b' }}>{stats.brands}+</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Brands Tracked</p>
          </div>
          <div className="glass-card text-center py-5">
            <p className="text-2xl font-extrabold" style={{ color: '#22c55e' }}>{stats.offers}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Offers Discovered</p>
          </div>
          <div className="glass-card text-center py-5">
            <p className="text-2xl font-extrabold" style={{ color: '#3b82f6' }}>{stats.websites}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Websites Scanned</p>
          </div>
          <div className="glass-card text-center py-5">
            <p className="text-2xl font-extrabold" style={{ color: '#a855f7' }}>{stats.codes}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Active Codes</p>
          </div>
        </div>

        <div className="mt-10 space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>
            CodeXhange is a community-driven search engine for active promo codes and discount codes. 
            Unlike traditional coupon sites that rely on automated scraping and leave expired codes 
            live indefinitely, CodeXhange uses a hybrid approach: an intelligent bot discovers deals 
            from trusted sources, while our community votes to keep every code verified and accurate.
          </p>
          <p>
            Every code on our platform has a community success rating based on upvotes and downvotes. 
            Codes that fall below a 30% success rate with 5+ negative votes are automatically archived 
            in the Dustbin. This self-cleaning mechanism ensures search engines only index accurate, 
            active deals — and shoppers never waste time on expired codes.
          </p>
          <p>
            Behind the scenes, our Python-based bot continuously scans {stats.websites} websites, 
            discovering new promo codes, referral deals, and discounts. Each offer goes through 
            confidence scoring and optional AI enrichment before being published.
          </p>
          <p>
            Merchants, creators, and affiliate marketers can submit their promo codes 
            to the top of high-traffic brand pages. This creates a decentralized advertising economy 
            where contributors are rewarded for their efforts and businesses get free, targeted visibility.
          </p>
        </div>
      </div>
    </div>
  );
}
