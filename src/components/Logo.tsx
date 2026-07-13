import Link from 'next/link';

interface LogoProps {
  href?: string;
  className?: string;
  variant?: 'full' | 'icon';
}

function LogoSvg({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      role="img"
      aria-label="CodeXhange logo"
    >
      {/* Left curly brace — code symbol */}
      <path
        d="M6 10c-2.5 0-4 1.5-4 4v6c0 2.5-1.5 4-4 4"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6 24c-2.5 0-4-1.5-4-4v-6c0-2.5-1.5-4-4-4"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />

      {/* Right curly brace — code symbol */}
      <path
        d="M28 10c2.5 0 4 1.5 4 4v6c0 2.5 1.5 4 4 4"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28 24c2.5 0 4-1.5 4-4v-6c0-2.5 1.5-4 4-4"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />

      {/* Exchange arrows in center */}
      <path
        d="M14 20l-3 3 3 3"
        stroke="#f59e0b"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M11 23h8"
        stroke="#f59e0b"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 11l3-3-3-3"
        stroke="#f59e0b"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M23 8h-8"
        stroke="#f59e0b"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ href, className = '', variant = 'full' }: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoSvg />
      {variant === 'full' && (
        <span className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Code<span style={{ color: '#f59e0b' }}>Xhange</span>
        </span>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
