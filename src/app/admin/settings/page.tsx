'use client';

import { useState, useEffect } from 'react';
import { adminHeaders } from '@/lib/adminFetch';

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const testConnection = async () => {
    if (!aiProvider || !aiKey) { setTestResult({ ok: false, message: 'Provider + API key required' }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await window.fetch('/api/admin/settings/test', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ provider: aiProvider, api_key: aiKey, model: aiModel, base_url: aiBaseUrl }),
      });
      const d = await res.json();
      setTestResult({ ok: !!d.ok, message: d.message || (d.ok ? 'OK' : 'Failed') });
    } catch {
      setTestResult({ ok: false, message: 'Network error' });
    }
    setTesting(false);
  };

  const providerDefaults: Record<string, { baseUrl: string; models: { value: string; label: string }[] }> = {
    gemini: {
      baseUrl: '',
      models: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (free, recommended)' },
        { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite (free, faster)' },
      ],
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      models: [
        { value: 'llama3-70b-8192', label: 'LLaMA 3 70B (fast)' },
        { value: 'llama3-8b-8192', label: 'LLaMA 3 8B (fastest)' },
        { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (large context)' },
        { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
      ],
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      models: [
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4o', label: 'GPT-4o' },
      ],
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      models: [
        { value: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra 550B (free)' },
        { value: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (free)' },
        { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'LLaMA 3.3 70B (free)' },
        { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)' },
      ],
    },
  };

  useEffect(() => {
    window.fetch('/api/admin/settings').then(r => r.ok && r.json()).then(d => {
      if (d) {
        setAiProvider(d.provider || '');
        setAiKey(d.api_key || '');
        setAiModel(d.model || '');
        setAiBaseUrl(d.base_url || '');
        setAiEnabled(d.enabled || false);
      }
    }).catch(() => {});
  }, []);

  const handleProviderChange = (p: string) => {
    setAiProvider(p);
    const defaults = providerDefaults[p];
    if (defaults) {
      setAiBaseUrl(defaults.baseUrl);
      if (defaults.models.length > 0) {
        setAiModel(defaults.models[0].value);
      }
    }
  };

  const save = async () => {
    if (aiProvider && !aiKey) {
      alert('API key is required when a provider is selected');
      return;
    }
    const res = await window.fetch('/api/admin/settings', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ provider: aiProvider, api_key: aiKey, model: aiModel, base_url: aiBaseUrl, enabled: aiEnabled }),
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
                <select value={aiProvider} onChange={e => handleProviderChange(e.target.value)}
                  className="input-glass px-3 py-2 text-sm w-full" style={{ color: 'var(--text-primary)' }}>
                  <option value="">— Disabled —</option>
                  <option value="gemini">Gemini (Google, free tier)</option>
                  <option value="groq">Groq (fast inference, free tier)</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter (any model, free tier)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>API Key</label>
                <input value={aiKey} onChange={e => setAiKey(e.target.value)}
                  placeholder={aiProvider ? "Enter your API key" : "Select a provider first"}
                  className="input-glass px-3 py-2 text-sm w-full"
                  type="password" />
              </div>
              {aiProvider === 'groq' || aiProvider === 'openai' || aiProvider === 'openrouter' ? (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Base URL</label>
                  <input value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)}
                    className="input-glass px-3 py-2 text-sm w-full font-mono text-xs"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
              ) : null}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Model</label>
                <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                  className="input-glass px-3 py-2 text-sm w-full" style={{ color: 'var(--text-primary)' }}>
                  {(providerDefaults[aiProvider]?.models || []).length > 0
                    ? providerDefaults[aiProvider].models.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))
                    : (
                      <>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash (free, recommended)</option>
                        <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (free, faster)</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="llama3-70b-8192">LLaMA 3 70B (Groq)</option>
                        <option value="llama3-8b-8192">LLaMA 3 8B (Groq)</option>
                      </>
                    )
                  }
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

          <div className="flex items-center gap-3">
            <button onClick={save} className="btn-primary px-5 py-2 text-sm">{saved ? 'Saved ✓' : 'Save Settings'}</button>
            <button onClick={testConnection} disabled={testing} className="btn-glass px-4 py-2 text-sm">
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            {testResult && (
              <span className="text-xs" style={{ color: testResult.ok ? '#22c55e' : '#ef4444' }}>
                {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
