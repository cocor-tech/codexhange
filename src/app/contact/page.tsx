import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact CodeXhange',
  description: 'Get in touch with the CodeXhange team. Report expired codes, suggest brands, or ask questions.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Contact Us</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Have a question or want to report an issue? Reach out to us.
        </p>
        <div className="mt-8 space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p><strong style={{ color: 'var(--text-primary)' }}>Email:</strong> support@codexhange.com</p>
          <p><strong style={{ color: 'var(--text-primary)' }}>Report expired codes:</strong> Use the vote buttons on any promo code page, or email us with the brand name and code.</p>
          <p><strong style={{ color: 'var(--text-primary)' }}>Suggest a brand:</strong> Let us know which stores or services you want discount codes for.</p>
        </div>
      </div>
    </div>
  );
}
