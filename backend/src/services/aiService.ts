export interface AiContext {
  userName: string;
  tone: 'rigorous' | 'balanced' | 'empathetic';
  activeGoals: Array<{ title: string; progress: number; deadline: string }>;
  todayTasks: Array<{ title: string; status: string; priority: string }>;
  habits: Array<{ name: string; currentStreak: number; completedToday: boolean }>;
  monthlySavings: { income: number; expenses: number; net: number };
  memories: string[];
}

export function buildSystemPrompt(context: AiContext): string {
  const toneDirectives = {
    rigorous: `You are direct, uncompromising, and highly analytical. You challenge excuses, demand rigor, and keep the user accountable to their stated highest potential.`,
    balanced: `You are a balanced strategic advisor. You combine realistic optimism with grounded milestone tracking.`,
    empathetic: `You are an encouraging, supportive performance coach who emphasizes mental resilience and steady progress.`,
  };

  return `
You are EVO — the personal AI operating system for ${context.userName}.
Role: Executive intelligence, life operating system, and personal strategist.

${toneDirectives[context.tone] || toneDirectives.rigorous}

CURRENT USER CONTEXT:
- Active Goals: ${context.activeGoals.map(g => `${g.title} (${g.progress}%, Due: ${g.deadline})`).join(', ')}
- Today's Tasks: ${context.todayTasks.map(t => `[${t.status.toUpperCase()}] ${t.title} (${t.priority})`).join(', ')}
- Habits: ${context.habits.map(h => `${h.name}: ${h.completedToday ? 'Done' : 'Pending'} (${h.currentStreak} day streak)`).join(', ')}
- Financial Pace: Net ₹${context.monthlySavings.net.toLocaleString()} (Income: ₹${context.monthlySavings.income.toLocaleString()}, Expenses: ₹${context.monthlySavings.expenses.toLocaleString()})
- Long-Term User Memories:
${context.memories.map(m => `  • ${m}`).join('\n')}

OPERATING PRINCIPLES:
1. Ground every recommendation in their active goals (Mastering Java/DSA, Vyralabs launch, Software Engineering role).
2. Proactively protect streaks and high-priority milestones.
3. Suggest concrete action items with specific times and priority rankings.
`.trim();
}

export async function getAiResponse(prompt: string, context: AiContext): Promise<{
  reply: string;
  actions?: Array<{ label: string; action: string; type: 'primary' | 'secondary' }>;
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return {
      reply: 'Gemini is not configured yet. Add GEMINI_API_KEY to backend/.env and restart the backend to enable live AI responses.',
      actions: [],
    };
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const configuredTimeout = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.min(configuredTimeout, 30000)
    : 12000;
  const systemPrompt = buildSystemPrompt(context);
  const requestModel = (modelName: string) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.5 },
      }),
    },
  );

  const readError = async (response: Response) => {
    try {
      const errorBody = await response.json() as { error?: { message?: string } };
      return errorBody.error?.message || 'Check the API key, model name, and Google AI Studio quota.';
    } catch {
      return 'Check the API key, model name, and Google AI Studio quota.';
    }
  };

  try {
    let response: Response;
    try {
      response = await requestModel(model);
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (!timedOut || fallbackModel === model) throw error;
      console.warn(`Gemini model ${model} timed out; trying ${fallbackModel}.`);
      response = await requestModel(fallbackModel);
    }

    if ((response.status === 429 || response.status === 503) && fallbackModel !== model) {
      const detail = await readError(response);
      console.warn(`Gemini model ${model} returned HTTP ${response.status}; trying ${fallbackModel}: ${detail}`);
      response = await requestModel(fallbackModel);
    }

    if (!response.ok) {
      const detail = await readError(response);
      console.error(`Gemini API returned HTTP ${response.status}: ${detail}`);
      const busy = response.status === 429 || response.status === 503;
      return {
        reply: busy
          ? 'Gemini is busy right now. Please try again in a moment.'
          : `Gemini API error (${response.status}): ${detail}`,
        actions: [],
      };
    }

    const data = await response.json() as any;
    const answer = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
    if (!answer) {
      return { reply: 'Gemini returned no text for that message. Try rephrasing it or check the API response in the backend log.', actions: [] };
    }

    return {
      reply: answer,
      actions: [
        { label: 'Accept Directives', action: 'accept_plan', type: 'primary' },
        { label: 'Adjust Plan', action: 'adjust_plan', type: 'secondary' },
      ],
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error(timedOut ? 'Gemini API request timed out.' : 'Could not reach the Gemini API:', error);
    return {
      reply: timedOut
        ? 'Gemini took too long to respond. Please try again in a moment.'
        : 'Could not reach the Gemini API. Check the backend internet connection and try again.',
      actions: [],
    };
  }
}
