'use client';

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button onClick={copy}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
        copied ? 'bg-green-500/20 text-green-500 border-green-500/50' : 'hover:bg-[var(--hover-overlay)]'
      }`}
      style={{ borderColor: copied ? '#22c55e50' : 'var(--border)', color: copied ? '#22c55e' : 'var(--text-primary)' }}>
      {copied ? (
        <>✓ Copied</>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}
