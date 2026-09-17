/**
 * Shared "how much of this project is done" calculation (section 6 —
 * "אחוז משימות שהושלמו, במשקל שווה לכל משימה") and the dashboard's
 * completed/open counts (section 7). "Done" is whatever status(es) the
 * admin marked is_completed in system settings (3.3) — never a hardcoded
 * status name.
 */
export function computeProgress(
  statusIds: (string | null | undefined)[],
  completedStatusIds: ReadonlySet<string>,
) {
  const total = statusIds.length;
  const completed = statusIds.filter(
    (id) => id && completedStatusIds.has(id),
  ).length;
  return {
    total,
    completed,
    percent: total === 0 ? null : Math.round((completed / total) * 100),
  };
}
