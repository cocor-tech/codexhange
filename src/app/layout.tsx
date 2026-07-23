import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import { Navbar } from '@/components/Navbar';
import { PageviewTracker } from '@/components/PageviewTracker';
import { FooterWrapper } from '@/components/FooterWrapper';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  icons: [{ rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' }],
  title: {
    default: 'CodeXhange — Active Promo Codes & Discounts | Community Verified',
    template: '%s | CodeXhange',
  },
  description: 'Find working promo codes and discount codes verified by real shoppers. Community-rated deals for thousands of brands. No login required to browse.',
  keywords: ['promo codes', 'discount codes', 'coupon codes', 'deals', 'savings', 'community verified'],
  openGraph: {
    title: 'CodeXhange — Find Active Promo Codes & Discounts',
    description: 'Community-verified discount codes. No expired deals. No login required.',
    url: 'https://codexhange.com',
    siteName: 'CodeXhange',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeXhange — Active Promo Codes',
    description: 'Working promo codes verified by the community.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased flex min-h-screen flex-col`}>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('codexhange-theme');document.documentElement.className=t||'light'}catch(e){}})()`
        }} />
          <ToastProvider>
          <PageviewTracker />
          <Navbar />
          <div className="flex-1">{children}</div>
          <FooterWrapper />
          </ToastProvider>
      </body>
    </html>
  );
}
