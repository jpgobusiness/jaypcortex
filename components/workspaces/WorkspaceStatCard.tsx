export default function WorkspaceStatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 truncate text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
