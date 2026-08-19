import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PatientTodos } from "./PatientTodos";
import { defaultMedications, defaultSystems, type Patient } from "@/types/patient";

const patient: Patient = {
  id: "patient-1",
  patientNumber: 1,
  name: "Test Patient",
  mrn: "TEST-1",
  bed: "T-1",
  clinicalSummary: "",
  intervalEvents: "",
  imaging: "",
  labs: "",
  systems: defaultSystems,
  medications: defaultMedications,
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2026-08-12T00:00:00.000Z",
  lastModified: "2026-08-12T00:00:00.000Z",
};

const defaultProps = {
  todos: [],
  section: null,
  patient,
  generating: false,
  onToggleTodo: async () => undefined,
  onDeleteTodo: async () => undefined,
  onGenerateTodos: async () => undefined,
  alwaysVisible: true,
  showAiGenerate: false,
};

afterEach(cleanup);

describe("PatientTodos entry", { concurrency: false }, () => {
  test("keeps todo deletion discoverable on touch-sized screens", () => {
    render(
      <PatientTodos
        {...defaultProps}
        onAddTodo={async () => undefined}
        todos={[
          {
            id: "todo-incomplete",
            patientId: patient.id,
            userId: "user-1",
            section: null,
            content: "Call family",
            completed: false,
            createdAt: "2026-08-12T00:00:00.000Z",
            updatedAt: "2026-08-12T00:00:00.000Z",
          },
          {
            id: "todo-complete",
            patientId: patient.id,
            userId: "user-1",
            section: null,
            content: "Review cultures",
            completed: true,
            createdAt: "2026-08-12T00:00:00.000Z",
            updatedAt: "2026-08-12T00:00:00.000Z",
          },
        ]}
      />,
    );

    for (const name of ["Delete todo: Call family", "Delete todo: Review cultures"]) {
      const deleteButton = screen.getByRole("button", { name });
      assert.ok(deleteButton.classList.contains("opacity-100"));
      assert.ok(deleteButton.classList.contains("sm:opacity-0"));
      assert.ok(deleteButton.classList.contains("sm:group-hover:opacity-100"));
    }
  });

  test("does not advertise AI in the focus-first empty state", () => {
    render(<PatientTodos {...defaultProps} onAddTodo={async () => undefined} />);

    assert.ok(screen.getByText("No todos yet. Add one when needed."));
    assert.equal(screen.queryByText(/generate with AI/i), null);
  });

  test("trims keyboard submissions and clears the field", async () => {
    const submitted: string[] = [];
    render(
      <PatientTodos
        {...defaultProps}
        onAddTodo={async (content) => {
          submitted.push(content);
          return {
            id: 'todo-1',
            patientId: patient.id,
            userId: 'user-1',
            section: null,
            content,
            completed: false,
            createdAt: '2026-08-12T00:00:00.000Z',
            updatedAt: '2026-08-12T00:00:00.000Z',
          };
        }}
      />,
    );

    const input = screen.getByRole("textbox", { name: "New todo" });
    fireEvent.change(input, { target: { value: "  Verify potassium  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      assert.deepEqual(submitted, ["Verify potassium"]);
      assert.equal((input as HTMLInputElement).value, "");
    });
  });

  test("retains the draft when persistence cannot accept the todo", async () => {
    render(<PatientTodos {...defaultProps} onAddTodo={async () => undefined} />);

    const input = screen.getByRole("textbox", { name: "New todo" });
    fireEvent.change(input, { target: { value: "Call family" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      assert.equal((input as HTMLInputElement).value, "Call family");
    });
  });

  test("blocks and announces todo drafts over the maximum length", () => {
    render(<PatientTodos {...defaultProps} onAddTodo={async () => undefined} />);

    const input = screen.getByRole("textbox", { name: "New todo" });
    fireEvent.change(input, { target: { value: "x".repeat(241) } });

    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(screen.getByRole("button", { name: "Add todo" }).hasAttribute("disabled"), true);
    assert.ok(screen.getByRole("alert").textContent?.includes("240 characters or fewer"));
  });
});
