"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dueDate = String(formData.get("due_date") || "") || null;

  if (!name) throw new Error("שם הפרויקט הוא שדה חובה");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("projects").insert({
    name,
    description: description || null,
    due_date: dueDate,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/projects");
}

/**
 * Links one or more tasks to a project (section 6 — a project can span
 * several boards/institutions, which is exactly why this is admin-only:
 * task_project_links_write is restricted to super_admin/network_admin).
 * Rows that are already linked are silently skipped rather than erroring.
 */
export async function linkTasks(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const taskIds = formData.getAll("task_ids").map(String);
  if (!projectId || !taskIds.length) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_project_links")
    .upsert(
      taskIds.map((taskId) => ({ task_id: taskId, project_id: projectId })),
      { onConflict: "task_id,project_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/projects/${projectId}`);
}

export async function unlinkTask(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const taskId = String(formData.get("task_id"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_project_links")
    .delete()
    .eq("project_id", projectId)
    .eq("task_id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/projects/${projectId}`);
}
