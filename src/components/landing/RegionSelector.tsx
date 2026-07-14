'use client';

const REGIONS = [
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'NG', label: 'Nigeria', flag: '🇳🇬' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'global', label: 'Global', flag: '🌍' },
];

function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const detected = tz.split('/').pop()?.slice(0, 2).toUpperCase() || '';
    const match = REGIONS.find((r) => r.code === detected);
    return match || REGIONS[REGIONS.length - 1];
  } catch {
    return REGIONS[REGIONS.length - 1];
  }
}

export function RegionSelector() {
  const region = detectRegion();

  return (
    <span
      className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
    >
      <span className="text-sm">{region.flag}</span>
      <span className="hidden sm:inline">{region.code === 'global' ? 'Global' : region.code}</span>
    </span>
  );
}
