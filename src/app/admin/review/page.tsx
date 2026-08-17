'use client';

import { useState, useEffect } from 'react';
import { adminHeaders } from '@/lib/adminFetch';

export default function ReviewPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await window.fetch('/api/admin/offers?status=pending_review&limit=100');
    if (res.ok) setOffers((await res.json()).offers || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReview = async (id: string, status: string) => {
    if (!window.confirm(` ${status} this offer?`)) return;
    await window.fetch('/api/admin/offers', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ offerId: id, status }),
    });
    load();
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Review Queue <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>({offers.length})</span></h1>
          <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
        </div>

        {loading ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
          <div className="space-y-3">
            {offers.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).map((o: any) => (
              <div key={o._id} className="glass-card flex items-center justify-between py-3 px-4 border-l-4" style={{ borderLeftColor: o.confidence >= 80 ? '#22c55e' : o.confidence >= 60 ? '#f59e0b' : '#ef4444' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{o.title}</span>
                    <span className="text-xs font-bold" style={{ color: o.confidence >= 80 ? '#22c55e' : o.confidence >= 60 ? '#f59e0b' : '#ef4444' }}>{o.confidence}%</span>
                    {o.code && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>{o.code}</span>}
                    <span className="text-[10px]" style={{ color: '#3b82f6' }}>{o.deal_type}</span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.store_name || 'Unknown'} · {o.discount} · {o.countries?.join(', ') || 'Global'}</p>
                  <a href={o.sourceUrl} target="_blank" className="text-[10px] underline" style={{ color: '#22c55e' }}>{o.sourceUrl}</a>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 ml-3">
                  <a href={o.sourceUrl} target="_blank" className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-blue-500/10 whitespace-nowrap" style={{ borderColor: 'var(--border)', color: '#3b82f6' }}>Visit</a>
                  <button onClick={() => handleReview(o._id, 'approved')} className="rounded-md px-3 py-1 text-[10px] font-medium border hover:bg-green-500/10" style={{ borderColor: 'var(--border)', color: '#22c55e' }}>Approve</button>
                  <button onClick={() => handleReview(o._id, 'archived')} className="rounded-md px-3 py-1 text-[10px] font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: '#ef4444' }}>Reject</button>
                </div>
              </div>
            ))}
            {offers.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No pending reviews. Add a website and scan it to get started.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
