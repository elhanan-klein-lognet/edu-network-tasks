export function ProgressBar({
  percent,
  label,
}: {
  percent: number | null;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-black"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      <p className="text-xs text-black/50">
        {label}
        {percent !== null ? ` — ${percent}%` : " (אין משימות משויכות)"}
      </p>
    </div>
  );
}
