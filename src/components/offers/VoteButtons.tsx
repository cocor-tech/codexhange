'use client';

import { useState } from 'react';

export function OfferVoteButtons({ offerId, upvotes = 0, downvotes = 0 }: { offerId: string; upvotes?: number; downvotes?: number }) {
  const [votes, setVotes] = useState({ upvotes, downvotes });
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  const vote = async (type: 'up' | 'down') => {
    const res = await fetch('/api/offers/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId, vote: type }),
    });
    if (res.status === 409) {
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setVotes({ upvotes: data.upvotes, downvotes: data.downvotes });
      setVoted(type);
    }
  };

  const total = votes.upvotes + votes.downvotes;
  const rate = total > 0 ? Math.round((votes.upvotes / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
      <button onClick={() => vote('up')}
        className={`flex items-center gap-0.5 transition-colors ${voted === 'up' ? 'text-green-500' : 'hover:text-green-500'}`}
        title="Useful">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        {votes.upvotes}
      </button>
      <button onClick={() => vote('down')}
        className={`flex items-center gap-0.5 transition-colors ${voted === 'down' ? 'text-red-500' : 'hover:text-red-500'}`}
        title="Expired/Not working">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a.5.5 0 01.484.06L17 7m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2" />
        </svg>
        {votes.downvotes}
      </button>
      {total > 0 && (
        <span className={`text-[10px] ${rate >= 70 ? 'text-green-500' : rate >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
          {rate}% success
        </span>
      )}
    </div>
  );
}
