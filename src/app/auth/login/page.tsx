'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

const errorMessages: Record<string, string> = {
  Callback: 'Google OAuth callback failed. Make sure your Google Cloud Console has the redirect URI set to https://codexhange.com/api/auth/callback/google',
  OAuthSignin: 'Google OAuth sign-in could not be initiated. Check your Google OAuth credentials.',
  OAuthCallback: 'Google returned an error during sign-in. The redirect URI may not match.',
  OAuthCreateAccount: 'Could not create an account from your Google profile.',
  EmailSignin: 'Email sign-in failed. Try again.',
  default: 'An authentication error occurred. Please try again.',
};

export default function LoginPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      const msg = errorMessages[err] || errorMessages.default;
      setUrlError(msg);
      toast(msg, 'error');
      window.history.replaceState({}, '', '/auth/login');
    }
  }, [toast]);

  useEffect(() => {
    if (session) {
      window.location.href = '/dashboard';
    }
  }, [session]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (session) return null;

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const res = await signIn('google', { callbackUrl: '/dashboard', redirect: false });
      if (res?.ok && res?.url) {
        window.location.href = res.url;
      } else {
        toast(res?.error === 'OAuthSignin' ? 'Google sign-in is not configured. Check your Google OAuth credentials.' : res?.error || 'Google sign-in failed. Try again.', 'error');
        setGoogleLoading(false);
      }
    } catch {
      toast('Network error. Please try again.', 'error');
      setGoogleLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSent(false);
    try {
      const res = await signIn('email', { email, callbackUrl: '/dashboard', redirect: false });
      if (res?.ok) {
        setSent(true);
        toast('Magic link sent! Check your inbox.', 'success');
      } else {
        const msg =
          res?.error === 'EmailSignin' ? 'Email sending failed. Try again.' :
          res?.error === 'EmailCreateAccount' ? 'Could not create account. Try again.' :
          res?.error ?? 'Something went wrong. Please try again.';
        toast(msg, 'error');
      }
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {urlError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-400">
          {urlError}
        </div>
      )}
      <Button onClick={handleGoogle} loading={googleLoading} variant="glass" className="w-full justify-center">
        <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <span className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>OR</span>
        <span className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
      </div>

      {sent ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/15 p-4 text-center text-sm text-green-400">
          <p className="font-semibold">Magic link sent!</p>
          <p className="mt-1 text-green-400/70">Check your email inbox. No email? Check your spam folder.</p>
        </div>
      ) : (
        <form onSubmit={handleEmail} className="space-y-3">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <Button type="submit" loading={loading} className="w-full justify-center">
            Send Magic Link
          </Button>
        </form>
      )}
    </div>
  );
}
