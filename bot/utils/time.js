export function relativeTime(date) {
  if (!date) return 'Never';
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function verifiedLabel(verifiedAt, status) {
  if (status === 'expired') return 'Expired';
  if (!verifiedAt) return 'Unverified';
  const rel = relativeTime(verifiedAt);
  if (rel === 'Just now' || rel.includes('min')) return `Verified ${rel}`;
  if (rel.includes('h')) return `Verified ${rel}`;
  if (rel === 'Yesterday') return 'Verified yesterday';
  if (rel.includes('d') || rel.includes('w')) return `Last checked ${rel}`;
  return `Verified ${rel}`;
}

export function isoDate(date) {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
}
