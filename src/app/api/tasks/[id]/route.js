import { connection } from "next/server";
import { deleteTask, getTask, updateTask, validateTask } from "@/server/tasks";

async function readId(params) {
  const { id } = await params;
  return /^\d+$/.test(id) ? id : null;
}

const notFound = () => Response.json({ error: "Task not found" }, { status: 404 });

// GET /api/tasks/:id
export async function GET(_request, { params }) {
  await connection();
  const id = await readId(params);
  if (!id) return notFound();
  try {
    const task = await getTask(id);
    return task ? Response.json({ task }) : notFound();
  } catch (error) {
    console.error("GET /api/tasks/:id failed:", error);
    return Response.json({ error: "Could not load task" }, { status: 500 });
  }
}

// PATCH /api/tasks/:id — any of { title, notes, dueAt, isDone }
export async function PATCH(request, { params }) {
  const id = await readId(params);
  if (!id) return notFound();
  const body = await request.json().catch(() => null);
  const { data, error } = validateTask(body, { partial: true });
  if (error) return Response.json({ error }, { status: 400 });

  try {
    const task = await updateTask(id, data);
    return task ? Response.json({ task }) : notFound();
  } catch (err) {
    console.error("PATCH /api/tasks/:id failed:", err);
    return Response.json({ error: "Could not update task" }, { status: 500 });
  }
}

// DELETE /api/tasks/:id
export async function DELETE(_request, { params }) {
  const id = await readId(params);
  if (!id) return notFound();
  try {
    return (await deleteTask(id)) ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    console.error("DELETE /api/tasks/:id failed:", error);
    return Response.json({ error: "Could not delete task" }, { status: 500 });
  }
}
