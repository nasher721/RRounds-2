 /**
  * AI Response Utilities
  * Helper functions to safely handle AI responses that might be objects instead of strings
  */
 
 /**
  * Ensures a value is a string, converting objects to JSON if necessary.
  * Prevents React "Objects are not valid as a React child" errors.
  */
 export function ensureString(value: unknown): string {
   if (value === null || value === undefined) {
     return '';
   }
   if (typeof value === 'string') {
     return value;
   }
   if (typeof value === 'number' || typeof value === 'boolean') {
     return String(value);
   }
   // Handle objects and arrays - convert to formatted JSON
   try {
     return JSON.stringify(value, null, 2);
   } catch {
     return String(value);
   }
 }
 
 /**
  * Safely extracts a string field from an AI response object.
  * Falls back to JSON stringification if the value is not a string.
  */
 export function extractStringField(data: Record<string, unknown>, field: string): string {
   const value = data?.[field];
   return ensureString(value);
 }