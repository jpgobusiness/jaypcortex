export default function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  crumbs?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
      <div className="min-w-0">
        {crumbs && <div className="mb-1.5">{crumbs}</div>}
        <h1 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">
          {title}
        </h1>
        {subtitle &&
          (typeof subtitle === "string" ? (
            <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>
          ) : (
            <div className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</div>
          ))}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
