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

export function generateSimulatedAiResponse(prompt: string, context: AiContext): {
  reply: string;
  actions?: Array<{ label: string; action: string; type: 'primary' | 'secondary' }>;
} {
  const lower = prompt.toLowerCase();

  if (lower.includes('today') || lower.includes('plan')) {
    return {
      reply: `Here is your optimized execution protocol for today, ${context.userName}:

1. **Deep Work Block (09:00 - 10:30)**: Solve 2 DSA Tree problems. You have a 14-day streak to defend.
2. **Technical Mastery (10:30 - 11:30)**: Complete Java Multithreading module (ExecutorService & locks).
3. **Agency Growth (11:30 - 12:30)**: Contact 5 prospective clients for Vyralabs.
4. **Physical Reset (17:30)**: Upper body strength session.
5. **Evening Protocol (20:00)**: Daily review & review tomorrow's calendar.

Total estimated focus time: 3.5 hours. No zero days.`,
      actions: [
        { label: 'Schedule Blocks', action: 'accept_plan', type: 'primary' },
        { label: 'Adjust Priorities', action: 'adjust_plan', type: 'secondary' },
      ],
    };
  }

  if (lower.includes('finance') || lower.includes('money') || lower.includes('budget') || lower.includes('save')) {
    return {
      reply: `Financial status audit:
• Total Income: ₹${context.monthlySavings.income.toLocaleString()}
• Total Expenses: ₹${context.monthlySavings.expenses.toLocaleString()}
• Net Savings: ₹${context.monthlySavings.net.toLocaleString()}

Observation: You have allocated 37% toward your ₹50,000 Emergency Fund. Your primary food expenses have been slightly higher over the weekend. Keep discretionary daily spend below ₹400 for the remainder of the month to hit your target.`,
      actions: [
        { label: 'Log New Expense', action: 'log_expense', type: 'primary' },
        { label: 'View Savings Timeline', action: 'view_savings', type: 'secondary' },
      ],
    };
  }

  if (lower.includes('risk') || lower.includes('goal')) {
    return {
      reply: `Trajectory Risk Assessment:

⚠️ **At Risk: Save ₹50,000**
• Target Deadline: Mar 2027
• Current pace: ₹1,200/week (needs ₹1,800/week)
• Corrective action: Transfer ₹2,400 from next consulting milestone directly to savings.

✅ **Strong Momentum: Master Java & Spring Boot (78%)**
• 21-day streak. Multithreading concepts 85% completed.

Would you like to auto-adjust your daily study and outreach plan?`,
      actions: [
        { label: 'Adjust my plan', action: 'adjust_plan', type: 'primary' },
        { label: 'Show details', action: 'show_details', type: 'secondary' },
      ],
    };
  }

  return {
    reply: `I have updated your context model. To reach your goal of landing a SWE role and scaling Vyralabs, consistency on the daily fundamentals is everything. 

What specific area would you like to review: DSA trajectory, Vyralabs outreach, or tomorrow's time blocks?`,
    actions: [
      { label: 'Review DSA Trajectory', action: 'review_dsa', type: 'primary' },
      { label: 'Plan Tomorrow', action: 'accept_plan', type: 'secondary' },
    ],
  };
}

export async function getAiResponse(prompt: string, context: AiContext): Promise<{
  reply: string;
  actions?: Array<{ label: string; action: string; type: 'primary' | 'secondary' }>;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'your_gemini_api_key_here') {
    try {
      const systemPrompt = buildSystemPrompt(context);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return {
            reply: text,
            actions: [
              { label: 'Accept Directives', action: 'accept_plan', type: 'primary' },
              { label: 'Adjust Plan', action: 'adjust_plan', type: 'secondary' },
            ],
          };
        }
      }
    } catch {
      // Fall through to simulated AI engine
    }
  }

  return generateSimulatedAiResponse(prompt, context);
}
