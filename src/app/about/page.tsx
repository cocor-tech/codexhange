import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About CodeXhange | Community Promo Code Library',
  description: 'CodeXhange is a community-driven discount code platform. Learn how we keep promo codes verified and up to date.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>About CodeXhange</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>
            CodeXhange is a community-driven search engine for active promo codes and discount codes. 
            Unlike traditional coupon sites that rely on automated scraping and leave expired codes 
            live indefinitely, CodeXhange relies on community voting to keep codes 
            to curate, verify, and share working discounts.
          </p>
          <p>
            Every code on our platform has a community success rating based on upvotes and downvotes. 
            Codes that fall below a 30% success rate with 5+ negative votes are automatically archived 
            in the Dustbin. This self-cleaning mechanism ensures search engines only index accurate, 
            active deals — and shoppers never waste time on expired codes.
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
