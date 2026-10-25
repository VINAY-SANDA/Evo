const test = require('node:test');
const assert = require('node:assert/strict');
const { getAiResponse } = require('../dist/services/aiService.js');

const context = {
  userName: 'EVO test user',
  tone: 'balanced',
  activeGoals: [],
  todayTasks: [],
  habits: [],
  monthlySavings: { income: 0, expenses: 0, net: 0 },
  memories: [],
};

async function withGeminiConfig(fetchMock, run) {
  const originalFetch = global.fetch;
  const originalEnvironment = {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL,
    timeout: process.env.GEMINI_REQUEST_TIMEOUT_MS,
  };

  process.env.GEMINI_API_KEY = 'fixture-key';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
  process.env.GEMINI_REQUEST_TIMEOUT_MS = '1000';
  global.fetch = fetchMock;

  try {
    await run();
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      GEMINI_API_KEY: originalEnvironment.apiKey,
      GEMINI_MODEL: originalEnvironment.model,
      GEMINI_FALLBACK_MODEL: originalEnvironment.fallbackModel,
      GEMINI_REQUEST_TIMEOUT_MS: originalEnvironment.timeout,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('retries a Gemini overload with the lightweight fallback model', async () => {
  const calls = [];
  await withGeminiConfig(async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return new Response(JSON.stringify({ error: { message: 'model is busy' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Try a short focus block.' }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    const result = await getAiResponse('What should I do?', context);
    assert.equal(result.reply, 'Try a short focus block.');
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /gemini-3\.8-flash:generateContent/);
    assert.match(calls[1].url, /gemini-3\.5-flash-lite:generateContent/);
    assert.equal(calls[0].options.signal instanceof AbortSignal, true);
  });
});

test('returns a brief message when both Gemini models are overloaded', async () => {
  let callCount = 0;
  await withGeminiConfig(async () => {
    callCount += 1;
    return new Response(JSON.stringify({ error: { message: 'high demand' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    const result = await getAiResponse('What should I do?', context);
    assert.equal(callCount, 2);
    assert.match(result.reply, /Gemini is busy right now/);
  });
});
