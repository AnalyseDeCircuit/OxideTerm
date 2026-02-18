/**
 * AI Token Estimation Utilities
 *
 * Shared token counting and history trimming logic used by:
 * - aiChatStore (dynamic history trimming before API calls)
 * - ContextIndicator (visual token usage display)
 *
 * These are heuristic estimates — actual tokenization varies by model.
 */

import type { AiChatMessage } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// Token Estimation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rough token estimation (1 token ≈ 4 chars for English, ~1.5 for CJK)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Count CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkMatches = text.match(cjkRegex);
  const cjkCount = cjkMatches?.length || 0;

  // Non-CJK characters
  const nonCjkLength = text.length - cjkCount;

  // CJK: ~1.5 tokens per char, Latin: ~0.25 tokens per char (1 token ≈ 4 chars)
  return Math.ceil(cjkCount * 1.5 + nonCjkLength * 0.25);
}

// ═══════════════════════════════════════════════════════════════════════════
// Context Window Lookup
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hardcoded context window sizes by model name pattern.
 * Used as fallback when the provider API doesn't return context_length.
 */
const MODEL_CONTEXT_WINDOWS: Array<[RegExp, number]> = [
  // OpenAI
  [/gpt-4-turbo|gpt-4o/, 128000],
  [/gpt-4-32k/, 32000],
  [/gpt-4(?!o|-)/, 8192],
  [/gpt-3\.5-turbo-16k/, 16000],
  [/gpt-3\.5/, 4096],
  [/o[1-9]-|o[1-9]$/, 200000],
  // Anthropic
  [/claude-3|claude-sonnet|claude-opus|claude-haiku/, 200000],
  [/claude-2/, 100000],
  [/claude/, 100000],
  // Google
  [/gemini-2|gemini-1\.5/, 1048576],
  [/gemini/, 128000],
  // Meta
  [/llama-3\.1|llama-3\.2|llama-3\.3/, 128000],
  [/llama-3/, 8192],
  // Mistral
  [/mistral-large|mistral-medium/, 128000],
  [/mistral/, 32000],
  // Alibaba
  [/qwen-2\.5|qwen2\.5|qwen-max/, 128000],
  [/qwen/, 32000],
  // DeepSeek
  [/deepseek/, 128000],
];

/** Default context window for unknown models */
const DEFAULT_CONTEXT_WINDOW = 8192;

/**
 * Get context window size for a model.
 *
 * @param modelId - The model identifier string
 * @param cachedContextWindows - Optional provider-scoped cache: { [providerId]: { [modelId]: tokens } }
 * @param providerId - Optional provider id for scoped lookup (prevents cross-provider collisions)
 * @returns Context window size in tokens
 */
export function getModelContextWindow(
  modelId: string,
  cachedContextWindows?: Record<string, Record<string, number>>,
  providerId?: string,
): number {
  // 1. Provider-scoped lookup (most accurate, avoids cross-provider name collisions)
  if (providerId && cachedContextWindows?.[providerId]?.[modelId]) {
    return cachedContextWindows[providerId][modelId];
  }

  // 2. Fallback to pattern matching
  const lower = modelId.toLowerCase();
  for (const [pattern, size] of MODEL_CONTEXT_WINDOWS) {
    if (pattern.test(lower)) return size;
  }

  return DEFAULT_CONTEXT_WINDOW;
}

// ═══════════════════════════════════════════════════════════════════════════
// History Trimming
// ═══════════════════════════════════════════════════════════════════════════

/** Reserve tokens for the model's response — adaptive to context window size. */
function responseReserve(contextWindow: number): number {
  // Cap at 4096 but never more than 15 % of the context window.
  // This prevents the reserve from consuming the entire budget on 4 k–8 k models.
  return Math.min(4096, Math.floor(contextWindow * 0.15));
}

/**
 * Trim conversation history to fit within a token budget.
 *
 * Strategy: keep the most recent messages, dropping oldest first.
 * Always keeps at least the last user message.
 *
 * @param messages - Full conversation history
 * @param contextWindow - Model's context window in tokens
 * @param systemTokens - Tokens consumed by system prompt(s)
 * @param contextTokens - Tokens consumed by terminal context injection
 * @returns Trimmed array of messages (most recent subset that fits)
 */
export function trimHistoryToTokenBudget(
  messages: AiChatMessage[],
  contextWindow: number,
  systemTokens: number,
  contextTokens: number,
): AiChatMessage[] {
  // Budget = 70 % of context window minus fixed overhead
  const budget = Math.floor(contextWindow * 0.7) - systemTokens - contextTokens - responseReserve(contextWindow);

  if (budget <= 0) {
    // Edge case: not enough room, keep only the last message
    return messages.length > 0 ? [messages[messages.length - 1]] : [];
  }

  // Walk backwards, accumulating tokens
  let accumulated = 0;
  let keepFrom = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = estimateTokens(msg.content);
    if (accumulated + tokens > budget && i < messages.length - 1) {
      // Would exceed budget, stop here (but always keep at least the last message)
      break;
    }
    accumulated += tokens;
    keepFrom = i;
  }

  return messages.slice(keepFrom);
}
