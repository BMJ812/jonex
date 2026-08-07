interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  percentage?: number;
  tone?: "cyan" | "amber" | "magenta" | "success";
}

export function MetricCard({
  label,
  value,
  detail,
  percentage,
  tone = "cyan",
}: MetricCardProps) {
  const normalizedPercentage =
    percentage === undefined
      ? undefined
      : Math.max(0, Math.min(100, percentage));

  return (
    <article className="metric-card">
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      <div className="metric-card__detail">{detail}</div>
      {normalizedPercentage !== undefined ? (
        <div
          className="meter"
          aria-label={`${label}: ${normalizedPercentage.toFixed(1)} percent`}
        >
          <div
            className={`meter__fill meter__fill--${tone}`}
            style={{ width: `${normalizedPercentage}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}
