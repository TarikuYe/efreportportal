/**
 * Simple in-memory rate limiter for the AI chat API.
 * Limits each user to a configurable number of requests per window.
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

const MAX_REQUESTS = parseInt(process.env.AI_RATE_LIMIT_MAX ?? '30', 10) // requests per window
const WINDOW_MS = parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS ?? '60000', 10) // 1 minute

/**
 * Check if a user has exceeded the rate limit.
 * @param userId - Unique identifier for the user (Supabase user ID)
 * @returns { allowed: boolean; remaining: number; resetInMs: number }
 */
export function checkRateLimit(userId: string): {
  allowed: boolean
  remaining: number
  resetInMs: number
} {
  const now = Date.now()
  const entry = store.get(userId)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    store.set(userId, { count: 1, windowStart: now })
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetInMs: WINDOW_MS }
  }

  if (entry.count >= MAX_REQUESTS) {
    const resetInMs = WINDOW_MS - (now - entry.windowStart)
    return { allowed: false, remaining: 0, resetInMs }
  }

  entry.count++
  store.set(userId, entry)
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.count,
    resetInMs: WINDOW_MS - (now - entry.windowStart),
  }
}

/**
 * Periodically clean up expired entries to prevent memory leaks.
 * Runs every 5 minutes.
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > WINDOW_MS * 2) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}
