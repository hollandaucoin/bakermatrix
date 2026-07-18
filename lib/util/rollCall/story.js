import Anthropic from '@anthropic-ai/sdk';
import exampleStory from './examples/example.js';

// Server-side tools (code execution) run a server loop that pauses after ~10
// iterations with stop_reason "pause_turn". Large rosters need many resumes.
const MAX_CONTINUATIONS = 24;

const buildNamesCsv = (csv, names) => {
  if (typeof csv === 'string' && csv.trim()) {
    return csv.trim();
  }

  return ['name', ...names].join('\n');
};

/**
 * Pull the finished script out of the assembled message. With the code-execution
 * tool and a skill attached, `content` is an interleaved array (server_tool_use,
 * tool results, and multiple text blocks). Concatenate every text block, then
 * prefer the <story>...</story> section — never just the first text block, which
 * is usually intermediate narration rather than the final script.
 */
const extractStory = (content = []) => {
  const text = content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();

  const match = text.match(/<story>([\s\S]*?)<\/story>/i);
  return (match ? match[1] : text).trim();
};

export const generateRollCallStory = async ({ csv, names } = {}) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured on the server');
  }

  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('At least one name is required to generate a story');
  }

  const nameList = names.map((name) => String(name).trim()).filter(Boolean);
  const namesCsv = buildNamesCsv(csv, nameList);
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  // Slim prompt — the mt-baker-roll-call skill carries the method (partition the
  // roster before drafting, reference every delegate exactly once, and verify
  // coverage by running scripts/audit_roll_call.py). Duplicating those rules
  // here would conflict with / override the skill.
  const prompt = `Use the mt-baker-roll-call skill.

    You are writing a live-stage "roll call" script for Mt. Baker High School Leadership Camp, performed by 4 speakers. The session theme is "Reach".

    The <roster> below contains exactly ${nameList.length} delegates. Reference every delegate exactly once, following the skill's method. Match the voice, humor, pacing, and structure of <example_story>.

    About one third of the way through the script, include a dramatic reveal on its own line, exactly: ROLL CALL, MT. BAKER 2026! — written plainly with NO parentheses (it is not a delegate). It is the build-up payoff; the roster continues after it.

    Return ONLY the finished script inside a single <story> block — no preamble, audit, or notes.

    <roster>
    ${namesCsv}
    </roster>

    <example_story>
    ${exampleStory}
    </example_story>`;

  const requestParams = {
    model,
    // ~260-name scripts need a lot of output room; 16k was truncating them.
    max_tokens: 32000,
    // Required betas for custom Skills + server-side code execution.
    betas: ['code-execution-2025-08-25', 'skills-2025-10-02'],
    // Attach the custom Skill (uploaded via the Skills API). `version: 'latest'`
    // uses whatever version was last published — re-upload the skill folder to
    // roll out changes.
    container: {
      skills: [
        {
          type: 'custom',
          skill_id: process.env.ANTHROPIC_ROLL_CALL_SKILL_ID,
          version: 'latest',
        },
      ],
    },
    tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
  };

  const messages = [{ role: 'user', content: prompt }];

  let message;
  try {
    // Stream the request: a Skills + code-execution turn can run for minutes,
    // and a non-streaming fetch trips Node's ~5-minute header timeout ("fetch
    // failed"). Streaming keeps the connection alive and returns the assembled
    // message via finalMessage().
    for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
      const stream = client.beta.messages.stream({ ...requestParams, messages });
      message = await stream.finalMessage();

      // Resume a paused server-tool turn by appending the assistant turn and
      // re-streaming; the server resumes from the trailing server_tool_use block.
      if (message.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: message.content });
        continue;
      }
      break;
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const detail = `Claude API error ${err.status ?? ''}: ${err.message}`.trim();
      if (typeof err.message === 'string' && err.message.toLowerCase().includes('model')) {
        throw new Error(`${detail}. Check ANTHROPIC_MODEL in .env (default is claude-opus-4-8).`);
      }
      throw new Error(detail);
    }
    // Transport-level failure (DNS, TLS, proxy, timeout) — surface the cause.
    const cause = err?.cause?.code || err?.cause?.message || err?.cause;
    throw new Error(`Failed to reach Claude${cause ? ` (${cause})` : ''}: ${err.message}`);
  }

  const story = extractStory(message?.content);
  if (!story) {
    throw new Error('Claude returned an empty story');
  }

  return story;
};
