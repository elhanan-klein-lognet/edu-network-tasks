"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Creates a task plus its assignees and custom-field values in one go.
 * RLS (tasks_insert / task_assignees_write, section 9) is the real
 * enforcement — super_admin/network_admin anywhere, institution_manager
 * only within their own institution's boards. This action just shapes the
 * form data; a rejected insert surfaces as a thrown error either way.
 */
export async function createTask(formData: FormData) {
  const boardId = String(formData.get("board_id"));
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const statusId = String(formData.get("status_id"));
  const priorityId = String(formData.get("priority_id"));
  const dueDate = String(formData.get("due_date") || "") || null;
  const assigneeIds = formData.getAll("assignee_ids").map(String);

  if (!title || !boardId || !statusId || !priorityId) {
    throw new Error("כותרת, סטטוס ועדיפות הם שדות חובה");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rebuild custom_fields from the board's field definitions, keyed by
  // field id (stable even if a field is later renamed — see
  // board_custom_field_definitions, section 4).
  const { data: fieldDefs } = await supabase
    .from("board_custom_field_definitions")
    .select("id, field_type")
    .eq("board_id", boardId);

  const customFields: Record<string, unknown> = {};
  for (const def of fieldDefs ?? []) {
    const raw = formData.get(`custom_field__${def.id}`);
    if (raw === null || raw === "") continue;
    customFields[def.id] = def.field_type === "number" ? Number(raw) : String(raw);
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: description || null,
      board_id: boardId,
      status_id: statusId,
      priority_id: priorityId,
      due_date: dueDate,
      custom_fields: customFields,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (assigneeIds.length) {
    const { error: assigneeError } = await supabase
      .from("task_assignees")
      .insert(assigneeIds.map((userId) => ({ task_id: task.id, user_id: userId })));
    if (assigneeError) throw new Error(assigneeError.message);
  }

  revalidatePath(`/boards/${boardId}`);
}

/**
 * Full edit of an existing task: fields + assignee list. Assignees are
 * replaced wholesale (delete-all-then-insert) rather than diffed — simpler,
 * and correct, at the cost of the activity log recording a delete+insert
 * for every assignee on every edit, not just the ones that actually
 * changed. Fine for a POC; worth diffing if the audit trail needs to be
 * precise later.
 */
export async function updateTask(formData: FormData) {
  const taskId = String(formData.get("task_id"));
  const boardId = String(formData.get("board_id"));
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const statusId = String(formData.get("status_id"));
  const priorityId = String(formData.get("priority_id"));
  const dueDate = String(formData.get("due_date") || "") || null;
  const assigneeIds = formData.getAll("assignee_ids").map(String);

  if (!title || !taskId || !boardId || !statusId || !priorityId) {
    throw new Error("כותרת, סטטוס ועדיפות הם שדות חובה");
  }

  const supabase = await createClient();

  const { data: fieldDefs } = await supabase
    .from("board_custom_field_definitions")
    .select("id, field_type")
    .eq("board_id", boardId);

  const customFields: Record<string, unknown> = {};
  for (const def of fieldDefs ?? []) {
    const raw = formData.get(`custom_field__${def.id}`);
    if (raw === null || raw === "") continue;
    customFields[def.id] = def.field_type === "number" ? Number(raw) : String(raw);
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description: description || null,
      status_id: statusId,
      priority_id: priorityId,
      due_date: dueDate,
      custom_fields: customFields,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  const { error: deleteError } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId);
  if (deleteError) throw new Error(deleteError.message);

  if (assigneeIds.length) {
    const { error: insertError } = await supabase
      .from("task_assignees")
      .insert(assigneeIds.map((userId) => ({ task_id: taskId, user_id: userId })));
    if (insertError) throw new Error(insertError.message);
  }

  // Project links (section 6) only render in the edit form for
  // super_admin/network_admin (task_project_links_write is restricted to
  // those roles at the RLS level too) — the hidden marker distinguishes
  // "the field wasn't shown, leave links alone" from "shown and cleared to
  // none", so an institution_manager editing a task never wipes its
  // project links just by not seeing that field.
  if (formData.get("has_project_field") === "1") {
    const projectIds = formData.getAll("project_ids").map(String);

    const { error: deleteProjectsError } = await supabase
      .from("task_project_links")
      .delete()
      .eq("task_id", taskId);
    if (deleteProjectsError) throw new Error(deleteProjectsError.message);

    if (projectIds.length) {
      const { error: insertProjectsError } = await supabase
        .from("task_project_links")
        .insert(projectIds.map((projectId) => ({ task_id: taskId, project_id: projectId })));
      if (insertProjectsError) throw new Error(insertProjectsError.message);
    }
  }

  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/dashboard");
}

export async function updateTaskStatus(formData: FormData) {
  const taskId = String(formData.get("task_id"));
  const boardId = String(formData.get("board_id"));
  const statusId = String(formData.get("status_id"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status_id: statusId })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/dashboard");
}
