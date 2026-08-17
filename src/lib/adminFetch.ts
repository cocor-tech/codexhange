export function adminHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('admin_token') : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}