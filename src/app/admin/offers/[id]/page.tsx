'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { adminHeaders } from '@/lib/adminFetch';

export default function OfferDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await window.fetch(`/api/admin/offers/${id}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    };
    load();
  }, [id]);

  const handleAction = async (status: string) => {
    if (!window.confirm(` ${status} this offer?`)) return;
    const res = await window.fetch('/api/admin/offers', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ offerId: id, status }),
    });
    if (res.ok) window.location.reload();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}><p className="text-xs" style={{ color: '#ef4444' }}>Offer not found</p></div>;

  const o = data.offer;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-4xl px-6 py-6">
        <a href="/admin/offers" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Offers</a>

        <div className="flex items-start justify-between mt-3 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{o.title}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{o.store_name || 'Unknown'} · {o.discount}</p>
          </div>
          <div className="flex gap-2">
            <span className={`text-xs rounded-full px-2 py-0.5 ${
              o.status === 'published' ? 'bg-green-500/20 text-green-400' :
              o.status === 'pending_review' ? 'bg-yellow-500/20 text-yellow-400' :
              o.status === 'expired' ? 'bg-red-500/20 text-red-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>{o.status}</span>
            <span className="text-xs font-bold px-2 py-0.5" style={{ color: o.confidence >= 80 ? '#22c55e' : '#f59e0b' }}>{o.confidence}%</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="glass-card p-4">
            <h2 className="text-xs font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Details</h2>
            <div className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <div><span className="font-semibold">Code:</span> {o.code || '—'}</div>
              <div><span className="font-semibold">Type:</span> {o.deal_type || o.type}</div>
              <div><span className="font-semibold">Discount:</span> {o.discount}</div>
              <div><span className="font-semibold">Countries:</span> {o.countries?.join(', ') || 'Global'}</div>
              <div><span className="font-semibold">Found:</span> {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</div>
              <div><span className="font-semibold">Strategy:</span> {o.strategy || o.sourcePage || '—'}</div>
            </div>
          </div>
          <div className="glass-card p-4">
            <h2 className="text-xs font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Source</h2>
            <div className="space-y-2 text-xs">
              <a href={o.sourceUrl} target="_blank" className="block underline" style={{ color: '#22c55e' }}>{o.sourceUrl}</a>
              <div style={{ color: 'var(--text-muted)' }}>Reliability: {o.sourceReliability || 'Official Site'}</div>
              <div style={{ color: 'var(--text-muted)' }}>Page: {o.sourcePage}</div>
            </div>
          </div>
        </div>

        {o.description && (
          <div className="glass-card p-4 mb-6">
            <h2 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Description</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.description}</p>
          </div>
        )}

        {data.history?.length > 0 && (
          <div className="glass-card p-4 mb-6">
            <h2 className="text-xs font-bold mb-3" style={{ color: 'var(--text-primary)' }}>History</h2>
            <div className="space-y-1">
              {data.history.map((h: any) => (
                <div key={h._id} className="text-xs flex gap-3" style={{ color: 'var(--text-muted)' }}>
                  <span>{h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}</span>
                  <span>{h.previousStatus} → <span className="font-semibold">{h.newStatus}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {o.status !== 'published' && <button onClick={() => handleAction('published')} className="btn-primary px-4 py-2 text-sm">Publish</button>}
          {o.status !== 'approved' && <button onClick={() => handleAction('approved')} className="btn-glass px-4 py-2 text-sm">Approve</button>}
          {o.status !== 'archived' && <button onClick={() => handleAction('archived')} className="rounded-md px-4 py-2 text-sm font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: '#ef4444' }}>Archive</button>}
        </div>
      </div>
    </div>
  );
}
