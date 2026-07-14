import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | CodeXhange',
  description: 'CodeXhange terms of service. Rules for using the platform, submitting codes, and using affiliate links.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Terms of Service</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p>By using CodeXhange, you agree to these terms.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Use of Service</h2>
          <p>You may browse and copy promo codes freely without an account. Creating an account and contributing codes requires accurate information.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>User Conduct</h2>
          <p>Do not submit fake or expired codes. Do not manipulate voting through multi-account farming. Violations may result in account suspension.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Affiliate Links</h2>
          <p>Users may submit affiliate links alongside promo codes. CodeXhange is not responsible for the terms, commissions, or outcomes of any affiliate relationships between users and merchants.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Affiliate Links</h2>
          <p>Some outbound links on CodeXhange are affiliate links. We may earn a commission if you make a purchase through these links, at no extra cost to you.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Limitation of Liability</h2>
          <p>CodeXhange provides promo codes as-is. We do not guarantee that any code will work. Verify codes before making purchases.</p>
        </div>
      </div>
    </div>
  );
}
