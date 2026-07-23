'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const currentYear = new Date().getFullYear();

export function FooterWrapper() {
  const pathname = usePathname();
  
  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="border-t py-10 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center sm:text-left">
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Popular Brands</h4>
            <ul className="space-y-1.5">
              <li><Link href="/brand/best-buy" className="hover:text-[--text-primary] transition-colors">Best Buy Promo Codes</Link></li>
              <li><Link href="/brand/sephora" className="hover:text-[--text-primary] transition-colors">Sephora Promo Codes</Link></li>
              <li><Link href="/brand/chewy" className="hover:text-[--text-primary] transition-colors">Chewy Promo Codes</Link></li>
              <li><Link href="/brand/nike" className="hover:text-[--text-primary] transition-colors">Nike Promo Codes</Link></li>
              <li><Link href="/brand/walmart" className="hover:text-[--text-primary] transition-colors">Walmart Promo Codes</Link></li>
              <li><Link href="/brand/adidas" className="hover:text-[--text-primary] transition-colors">Adidas Promo Codes</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Categories</h4>
            <ul className="space-y-1.5">
              <li><Link href="/category/ai-tools-ai-saas" className="hover:text-[--text-primary] transition-colors">AI & SaaS</Link></li>
              <li><Link href="/category/e-commerce-fashion" className="hover:text-[--text-primary] transition-colors">Fashion</Link></li>
              <li><Link href="/category/e-commerce-electronics" className="hover:text-[--text-primary] transition-colors">Electronics</Link></li>
              <li><Link href="/category/travel-otas" className="hover:text-[--text-primary] transition-colors">Travel</Link></li>
              <li><Link href="/category/food-delivery-restaurants" className="hover:text-[--text-primary] transition-colors">Food & Delivery</Link></li>
              <li><Link href="/category/developer-tools-software" className="hover:text-[--text-primary] transition-colors">Dev Tools</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>The Platform</h4>
            <ul className="space-y-1.5">
              <li><Link href="/about" className="hover:text-[--text-primary] transition-colors">About CodeXhange</Link></li>
              <li><Link href="/contact" className="hover:text-[--text-primary] transition-colors">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Legal</h4>
            <ul className="space-y-1.5">
              <li><Link href="/privacy" className="hover:text-[--text-primary] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-[--text-primary] transition-colors">Terms of Service</Link></li>
              <li><Link href="/contact" className="hover:text-[--text-primary] transition-colors">Affiliate Disclosure</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center" style={{ borderColor: 'var(--border)' }}>
          <p>&copy; {currentYear} CodeXhange. Some links are affiliate links. We may earn a commission at no extra cost to you.</p>
        </div>
      </div>
    </footer>
  );
}
