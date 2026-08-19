import React, { useId, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  ListTodo, 
  Plus, 
  Sparkles, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { PatientTodo, TodoSection } from '@/types/todo';
import { Patient } from '@/types/patient';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MAX_TODO_LENGTH, validateTodoInput } from '@/lib/todoValidation';

interface PatientTodosProps {
  todos: PatientTodo[];
  section: string | null;
  patient: Patient;
  generating: boolean;
  onAddTodo: (content: string, section: string | null) => Promise<PatientTodo | undefined>;
  onToggleTodo: (todoId: string) => Promise<void>;
  onDeleteTodo: (todoId: string) => Promise<void>;
  onGenerateTodos: (patient: Patient, section: TodoSection) => Promise<void>;
  /** If true, todos are rendered inline (always visible) instead of in a popover */
  alwaysVisible?: boolean;
  /** Demote AI Generate off Focus mid-rounds path (use Tools → AI instead). Default true. */
  showAiGenerate?: boolean;
}

export function PatientTodos({
  todos,
  section,
  patient,
  generating,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onGenerateTodos,
  alwaysVisible = false,
  showAiGenerate = true,
}: PatientTodosProps) {
  const [newTodoText, setNewTodoText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const todoInputId = useId();
  const todoHelpId = `${todoInputId}-help`;
  const todoErrorId = `${todoInputId}-error`;
  const draftValidation = validateTodoInput(newTodoText);
  const displayedTodoError = newTodoText.trim().length > MAX_TODO_LENGTH
    ? `Todos must be ${MAX_TODO_LENGTH} characters or fewer.`
    : todoError;

  const { sectionTodos, incompleteTodos, completedTodos } = useMemo(() => {
    const sec = todos.filter(t => t.section === section);
    return {
      sectionTodos: sec,
      incompleteTodos: sec.filter(t => !t.completed),
      completedTodos: sec.filter(t => t.completed),
    };
  }, [todos, section]);

  const handleAddTodo = async () => {
    const result = validateTodoInput(newTodoText);
    if (!result.valid) {
      setTodoError(result.error);
      return;
    }
    setTodoError(null);
    setIsAdding(true);
    try {
      const added = await onAddTodo(result.value, section);
      if (added) setNewTodoText('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTodo();
    }
  };

  const handleGenerate = async () => {
    const todoSection = section === null ? 'all' : section as TodoSection;
    await onGenerateTodos(patient, todoSection);
  };

  // Shared todo list content
  // Keep this as an element, not a nested component. A nested component gets a
  // new identity on every keystroke and remounts the input, dropping focus.
  const todoListContent = (
    <div className="space-y-2">
      {/* Add new todo */}
      <div className="space-y-1.5">
        <label htmlFor={todoInputId} className="block text-sm font-medium text-foreground">
          New todo
        </label>
        <div className="flex gap-2">
          <Input
            id={todoInputId}
            placeholder="Add a todo..."
            value={newTodoText}
            maxLength={MAX_TODO_LENGTH}
            onChange={(e) => {
              setNewTodoText(e.target.value);
              if (todoError) setTodoError(null);
            }}
            onKeyDown={handleKeyDown}
            className="h-[44px] text-sm"
            aria-invalid={displayedTodoError ? true : undefined}
            aria-describedby={displayedTodoError ? `${todoHelpId} ${todoErrorId}` : todoHelpId}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddTodo}
            disabled={!draftValidation.valid || isAdding}
            className="h-[44px] px-3 disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            aria-label="Add todo"
            aria-describedby={todoHelpId}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p id={todoHelpId} className="text-xs text-muted-foreground">
          Press Enter to add. {newTodoText.length}/{MAX_TODO_LENGTH} characters.
        </p>
        {displayedTodoError ? (
          <p id={todoErrorId} className="text-sm font-medium text-destructive" role="alert">
            {displayedTodoError}
          </p>
        ) : null}
      </div>

      {/* Todo list */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {incompleteTodos.length === 0 && completedTodos.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {showAiGenerate
              ? 'No todos yet. Add one or generate with AI.'
              : 'No todos yet. Add one when needed.'}
          </p>
        )}

        {incompleteTodos.map(todo => (
          <div 
            key={todo.id} 
            className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 group"
          >
            <Checkbox
              checked={false}
              onCheckedChange={() => onToggleTodo(todo.id)}
              className="mt-0.5"
              aria-label={`Mark todo complete: ${todo.content}`}
            />
            <span className="flex-1 text-sm leading-tight">
              <span>{todo.content}</span>
              {todo.syncStatus ? (
                <span className="ml-2 inline-flex rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {todo.syncStatus === 'queued'
                    ? 'Queued'
                    : todo.syncStatus === 'conflict'
                      ? 'Conflict'
                      : 'Sync failed'}
                </span>
              ) : null}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteTodo(todo.id)}
              className="h-[44px] w-[44px] p-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              aria-label={`Delete todo: ${todo.content}`}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}

        {completedTodos.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground pt-2 pb-1">
              Completed ({completedTodos.length})
            </div>
            {completedTodos.map(todo => (
              <div 
                key={todo.id} 
                className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 group opacity-60"
              >
                <Checkbox
                  checked={true}
                  onCheckedChange={() => onToggleTodo(todo.id)}
                  className="mt-0.5"
                  aria-label={`Mark todo incomplete: ${todo.content}`}
                />
                <span className="flex-1 text-sm leading-tight line-through">
                  <span>{todo.content}</span>
                  {todo.syncStatus ? (
                    <span className="ml-2 inline-flex rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground no-underline">
                      {todo.syncStatus === 'queued'
                        ? 'Queued'
                        : todo.syncStatus === 'conflict'
                          ? 'Conflict'
                          : 'Sync failed'}
                    </span>
                  ) : null}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteTodo(todo.id)}
                  className="h-[44px] w-[44px] p-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Delete todo: ${todo.content}`}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  // Always visible inline mode
  if (alwaysVisible) {
    return (
      <div className="border border-border rounded-lg bg-muted/20 overflow-hidden">
        {/* Header with expand/collapse */}
        <div className="flex min-h-[44px] items-center justify-between bg-muted/40 px-1 transition-colors hover:bg-muted/60">
          <button
            type="button"
            className="flex min-h-[44px] flex-1 items-center gap-2 rounded-md px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-controls={`${todoInputId}-content`}
          >
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {section ? 'Section' : 'Patient'} To-Dos
            </span>
            {sectionTodos.length > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                incompleteTodos.length > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {incompleteTodos.length}/{sectionTodos.length}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
          <div className="flex items-center gap-1">
            {showAiGenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerate();
                }}
                disabled={generating}
                aria-busy={generating || undefined}
                aria-label={generating ? "Generating tasks" : "AI Generate tasks for this section"}
                className="min-h-[44px] text-xs gap-1"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">AI Generate</span>
              </Button>
            )}
            {generating ? (
              <span className="sr-only" role="status" aria-live="polite">
                Generating tasks…
              </span>
            ) : null}
          </div>
        </div>
        
        {/* Collapsible content */}
        {isExpanded && (
          <div id={`${todoInputId}-content`} className="px-3 py-2">
            {todoListContent}
          </div>
        )}
      </div>
    );
  }

  // Popover mode (default): labeled "+ Task" for discoverability (plan 3.1)
  const tasksTriggerLabel = section ? "Section tasks" : "Patient tasks";
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "min-h-[44px] gap-1.5 px-2.5 font-medium shrink-0",
            sectionTodos.length > 0 && "border-primary/40 text-foreground"
          )}
          aria-label={`${tasksTriggerLabel}: add or manage tasks. ${sectionTodos.length} total, ${incompleteTodos.length} incomplete.`}
        >
          <ListTodo className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm">+ Task</span>
          {sectionTodos.length > 0 ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs font-semibold tabular-nums">
              {incompleteTodos.length}/{sectionTodos.length}
            </Badge>
          ) : null}
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              {section ? 'Section' : 'Patient'} To-Dos
            </h4>
            {showAiGenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                aria-busy={generating || undefined}
                aria-label={generating ? "Generating tasks" : "AI Generate tasks for this section"}
                className="min-h-[44px] text-xs gap-1"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                )}
                AI Generate
              </Button>
            )}
            {generating ? (
              <span className="sr-only" role="status" aria-live="polite">
                Generating tasks…
              </span>
            ) : null}
          </div>

          {todoListContent}
        </div>
      </PopoverContent>
    </Popover>
  );
}
