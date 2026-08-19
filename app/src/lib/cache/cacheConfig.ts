// Centralized cache configuration
export const CACHE_CONFIG = {
  // Query cache TTL (in milliseconds)
  queries: {
    patients: 2 * 60 * 1000, // 2 minutes - frequently updated
    autotexts: 10 * 60 * 1000, // 10 minutes - rarely changes
    clinicalPhrases: 10 * 60 * 1000, // 10 minutes
    templates: 15 * 60 * 1000, // 15 minutes
    userDictionary: 30 * 60 * 1000, // 30 minutes
    fieldHistory: 5 * 60 * 1000, // 5 minutes
    todos: 2 * 60 * 1000, // 2 minutes
  },
  
  // Stale time (when to refetch in background)
  staleTime: {
    patients: 30 * 1000, // 30 seconds
    autotexts: 5 * 60 * 1000, // 5 minutes
    clinicalPhrases: 5 * 60 * 1000,
    templates: 10 * 60 * 1000,
    userDictionary: 15 * 60 * 1000,
    fieldHistory: 60 * 1000,
    todos: 30 * 1000,
  },
  
  // Retry configuration
  retry: {
    count: 3,
    delay: 1000,
    backoffMultiplier: 2,
  },
  
  // Prefetch configuration
  prefetch: {
    enabled: true,
    onHover: true,
    onFocus: true,
  },
  
  // Memory cache limits
  memory: {
    maxEntries: 100,
    maxAge: 60 * 60 * 1000, // 1 hour
  },
  
  // Local storage cache keys
  storageKeys: {
    queryCache: 'rq-cache',
    performanceMetrics: 'cache-metrics',
    lastSync: 'last-sync-time',
  },
} as const;

// Query keys for consistent cache management
export const QUERY_KEYS = {
  patients: ['patients'] as const,
  patientList: (userId: string | null) => ['patients', 'list', userId] as const,
  autotexts: ['autotexts'] as const,
  autotextList: (userId: string) => ['autotexts', 'list', userId] as const,
  clinicalPhrases: ['clinicalPhrases'] as const,
  clinicalPhraseList: (userId: string) => ['clinicalPhrases', 'list', userId] as const,
  phrase: (id: string) => ['clinicalPhrases', id] as const,
  templates: ['templates'] as const,
  templateList: (userId: string) => ['templates', 'list', userId] as const,
  userDictionary: ['userDictionary'] as const,
  userDictionaryList: (userId: string) => ['userDictionary', 'list', userId] as const,
  fieldHistoryForOwner: (userId: string, patientId: string) =>
    ['fieldHistory', 'owner', userId, patientId] as const,
  todos: ['todos'] as const,
  patientTodosForOwner: (userId: string, patientId: string) =>
    ['todos', 'owner', userId, patientId] as const,
  allTodos: ['allTodos'] as const,
} as const;
