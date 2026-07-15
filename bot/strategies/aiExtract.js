import fetch from 'node-fetch';

export async function aiExtractCodes(pageContent, brandName, url) {
  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const endpoint = process.env.XAI_API_KEY
    ? 'https://api.x.ai/v1/chat/completions'
    : process.env.OPENAI_API_KEY
    ? 'https://api.openai.com/v1/chat/completions'
    : process.env.ANTHROPIC_API_KEY
    ? 'https://api.anthropic.com/v1/messages'
    : null;

  if (!endpoint) return null;

  const model = process.env.XAI_API_KEY ? 'grok-1' :
    process.env.OPENAI_API_KEY ? 'gpt-4o-mini' :
    process.env.ANTHROPIC_API_KEY ? 'claude-3-haiku-20240307' : '';

  const systemPrompt = `You are a coupon/promo code extractor. Given page content from ${brandName} (${url}), extract any promo codes, coupon codes, discounts, or special offers found.

Return ONLY valid JSON array with objects containing:
- code: the actual promo/coupon code (null if none)
- discount: the discount amount/percentage
- title: brief description of the offer
- confidence: 0-100 score
- type: "promo_code" or "coupon" or "automatic_discount"

If no offers found, return empty array []. No markdown, no explanation, only JSON.`;

  try {
    let body;
    let headers = { 'Content-Type': 'application/json' };

    if (process.env.ANTHROPIC_API_KEY) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model,
        max_tokens: 500,
        messages: [{ role: 'user', content: `${systemPrompt}\n\nPage content:\n${pageContent.slice(0, 4000)}` }],
      };
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: pageContent.slice(0, 4000) },
        ],
        temperature: 0.1,
        max_tokens: 500,
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      timeout: 15000,
    });

    if (!res.ok) return null;

    const data = await res.json();
    let text;

    if (process.env.ANTHROPIC_API_KEY) {
      text = data.content?.[0]?.text || '';
    } else {
      text = data.choices?.[0]?.message?.content || '';
    }

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

    return null;
  } catch {
    return null;
  }
}
