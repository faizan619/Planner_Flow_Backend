import { connection } from "next/server";
import { createTask, listTasks, validateTask } from "@/server/tasks";

// GET /api/tasks — all tasks
export async function GET() {
  await connection();
  try {
    return Response.json({ tasks: await listTasks() });
  } catch (error) {
    console.error("GET /api/tasks failed:", error);
    return Response.json({ error: "Could not load tasks" }, { status: 500 });
  }
}

// POST /api/tasks — { title, notes?, dueAt? }
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { data, error } = validateTask(body);
  if (error) return Response.json({ error }, { status: 400 });

  try {
    return Response.json({ task: await createTask(data) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks failed:", err);
    return Response.json({ error: "Could not create task" }, { status: 500 });
  }
}
