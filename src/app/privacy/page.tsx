import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | CodeXhange',
  description: 'CodeXhange privacy policy. Learn how we collect, use, and protect your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Privacy Policy</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p>
            CodeXhange respects your privacy. This policy explains how we collect, use, and safeguard 
            your information when you visit our website.
          </p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Information We Collect</h2>
          <p>We collect minimal data: email address and anonymous usage analytics.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Cookies</h2>
          <p>We use local storage for theme preferences. We do not use tracking cookies.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Third-Party Services</h2>
          <p>We use Cloudflare for CDN and security. We use Google OAuth only if you choose to sign in with Google. We do not sell your data.</p>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Contact</h2>
          <p>Email us at support@codexhange.com with any privacy concerns.</p>
        </div>
      </div>
    </div>
  );
}
