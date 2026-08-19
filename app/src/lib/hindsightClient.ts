/**
 * Hindsight is intentionally disabled in the browser application.
 *
 * A browser-side API key is public to every user who downloads the bundle, and
 * these calls may contain clinical text. Re-enable this integration only
 * through an authenticated server-side proxy with an approved data-handling
 * contract; never add a VITE_* credential here.
 */

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type HindsightMetadata = Record<string, JsonValue>

export type HindsightFilters = Record<string, JsonValue>

export interface RetainMemoryParams {
  bankId: string
  content: string
  metadata?: HindsightMetadata
}

export interface HindsightMemory {
  id: string
  bankId: string
  content: string
  metadata?: HindsightMetadata
  createdAt?: string
  updatedAt?: string
}

export interface RecallMemoriesParams {
  bankId: string
  query: string
  filters?: HindsightFilters
  limit?: number
}

export interface RecallMemoriesResult {
  memories: HindsightMemory[]
}

export interface ReflectOnMemoriesParams {
  bankId: string
  query: string
  filters?: HindsightFilters
  maxTokens?: number
}

export interface HindsightReflection {
  summary: string
  insights?: string[]
  relatedMemories?: HindsightMemory[]
}

export interface ReflectOnMemoriesResult {
  reflection: HindsightReflection
}

export const retainMemory = async (
  params: RetainMemoryParams,
  options?: { signal?: AbortSignal }
): Promise<void> => {
  void params
  void options
}

export const recallMemories = async (
  params: RecallMemoriesParams,
  options?: { signal?: AbortSignal }
): Promise<RecallMemoriesResult | null> => {
  void params
  void options
  return null
}

export const reflectOnMemories = async (
  params: ReflectOnMemoriesParams,
  options?: { signal?: AbortSignal }
): Promise<ReflectOnMemoriesResult | null> => {
  void params
  void options
  return null
}
