export const MAX_TODO_LENGTH = 240;

export type TodoValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

export function validateTodoInput(input: string): TodoValidationResult {
  const value = input.trim();
  if (!value) {
    return { valid: false, error: "Enter a todo before adding it." };
  }
  if (value.length > MAX_TODO_LENGTH) {
    return {
      valid: false,
      error: `Todos must be ${MAX_TODO_LENGTH} characters or fewer.`,
    };
  }
  return { valid: true, value };
}
