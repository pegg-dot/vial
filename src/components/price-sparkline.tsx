export function PriceSparkline({ values, accent = "#6d5dfc", height = 58, uid }: { values: number[]; accent?: string; height?: number; uid?: string }) {
  const width = 180;
  const padding = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
  // Unique gradient id per instance — many sparklines can share accent+height on one page
  // (e.g. the compounds terminal table), so a uid keeps SVG ids from colliding (duplicate-id a11y).
  const gid = `gradient-${accent.replace("#", "")}-${height}${uid ? `-${uid.replace(/[^a-z0-9]/gi, "")}` : ""}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label={`Price history from $${values[0]} to $${values.at(-1)}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.25" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gid})`} />
      <polyline points={points} fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points.split(" ").at(-1)?.split(",")[0]} cy={points.split(" ").at(-1)?.split(",")[1]} r="3.2" fill={accent} stroke="white" strokeWidth="2" />
    </svg>
  );
}
