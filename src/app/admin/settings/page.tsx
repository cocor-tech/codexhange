'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.fetch('/api/admin/settings').then(r => r.ok && r.json()).then(d => {
      if (d) {
        setAiProvider(d.provider || '');
        setAiKey(d.api_key || '');
        setAiModel(d.model || '');
        setAiEnabled(d.enabled || false);
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (aiProvider && !aiKey) {
      alert('API key is required when a provider is selected');
      return;
    }
    const res = await window.fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: aiProvider, api_key: aiKey, model: aiModel, enabled: aiEnabled }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else { alert('Failed to save settings'); }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
          <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-5">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>AI Enrichment</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              AI enrichment runs after extraction to clean titles, classify offers, and generate tags. 
              It never blocks the bot — if AI fails, offers continue through the pipeline unchanged.
            </p>
            <div className="space-y-3 max-w-sm">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Provider</label>
                <select value={aiProvider} onChange={e => setAiProvider(e.target.value)}
                  className="input-glass px-3 py-2 text-sm w-full" style={{ color: 'var(--text-primary)' }}>
                  <option value="">— Disabled —</option>
                  <option value="gemini">Gemini (Google, free tier)</option>
                  <option value="openai">OpenAI</option>
                  <option value="huggingface">HuggingFace</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>API Key</label>
                <input value={aiKey} onChange={e => setAiKey(e.target.value)}
                  placeholder={aiProvider ? "Enter your API key" : "Select a provider first"}
                  className="input-glass px-3 py-2 text-sm w-full"
                  type="password" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Model</label>
                <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                  className="input-glass px-3 py-2 text-sm w-full" style={{ color: 'var(--text-primary)' }}>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (free, recommended)</option>
                  <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (free, faster)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />
                Enable AI enrichment
              </label>
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>General</h2>
            <div className="space-y-3 max-w-sm">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Concurrent Workers</label>
                <input type="range" min="1" max="30" value="15" className="w-full" />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>15</span>
              </div>
            </div>
          </div>

          <button onClick={save} className="btn-primary px-5 py-2 text-sm">{saved ? 'Saved ✓' : 'Save Settings'}</button>
        </div>
      </div>
    </div>
  );
}
