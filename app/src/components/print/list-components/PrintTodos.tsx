import { PatientTodo } from '@/types/todo';
import { cn } from '@/lib/utils';
import { CheckSquare, Square } from 'lucide-react';
import { PrintSection } from './PrintSection';
import * as React from 'react';

interface PrintTodosProps {
    todos: PatientTodo[];
    fontSize: number;
}

export const PrintTodos = ({ todos, fontSize }: PrintTodosProps) => {
    if (todos.length === 0) return null;

    return (
        <PrintSection
            title="Todos"
            fontSize={fontSize}
            variant="violet"
        >
            <ul className="space-y-1">
                {todos.map(todo => (
                    <li key={todo.id} className={cn("flex items-start gap-2", todo.completed && "line-through text-muted-foreground")}>
                        {todo.completed ? (
                            <CheckSquare className="h-4 w-4 mt-0.5 text-green-500" />
                        ) : (
                            <Square className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        )}
                        <span style={{ fontSize: 'var(--print-fs)' } as React.CSSProperties}>{todo.content}</span>
                    </li>
                ))}
            </ul>
        </PrintSection>
    );
};
