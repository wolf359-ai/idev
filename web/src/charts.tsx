import { scoreColor, scoreFromTap, scoreLevel } from "./format";

export function ScoreDots({
  value,
  readOnly,
  onRate,
}: {
  value: number | null;
  readOnly: boolean;
  onRate: (score: number) => void;
}) {
  const level = scoreLevel(value);
  return (
    <div className="dots" role="group" aria-label="Rate 1 to 5">
      {[1, 2, 3, 4, 5].map((dot) => {
        const current = value ?? 0;
        let state = "";
        if (current >= dot) state = "full";
        else if (current >= dot - 0.5) state = "half";
        return (
          <button
            key={dot}
            type="button"
            className={`dot ${state} score-${level || "empty"}`}
            disabled={readOnly}
            aria-label={
              dot === 1 ? "Rate 1 out of 5" : `Rate ${dot - 0.5} or ${dot} out of 5`
            }
            onClick={(event) => {
              if (readOnly) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const leftHalf = event.clientX - rect.left < rect.width / 2;
              onRate(scoreFromTap(dot, leftHalf));
            }}
          />
        );
      })}
    </div>
  );
}

export function Radar({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  if (items.length < 3) {
    return (
      <p className="empty">Rate at least three skills to see the strengths and weaknesses radar.</p>
    );
  }
  const size = 320;
  const padX = 70;
  const viewW = size + padX * 2;
  const cx = viewW / 2;
  const cy = size / 2;
  const radius = cy - 34;
  const angleFor = (index: number) => (Math.PI * 2 * index) / items.length - Math.PI / 2;
  const point = (index: number, ratio: number): [number, number] => {
    const angle = angleFor(index);
    return [cx + radius * ratio * Math.cos(angle), cy + radius * ratio * Math.sin(angle)];
  };
  const rings = [1, 2, 3, 4, 5].map((ring) => {
    const ratio = ring / 5;
    const pts = items.map((_, index) => point(index, ratio).map((n) => n.toFixed(1)).join(",")).join(" ");
    return (
      <polygon
        key={ring}
        points={pts}
        fill={ring === 5 ? "rgba(34,211,238,0.03)" : "none"}
        stroke={ring === 5 ? "#274152" : "#1c2735"}
        strokeWidth={ring === 5 ? 1.5 : 1}
      />
    );
  });
  const verts = items.map((item, index) => {
    const [x, y] = point(index, (item.value || 0) / 5);
    return { x, y, color: scoreColor(item.value) };
  });
  return (
    <svg viewBox={`0 0 ${viewW} ${size}`} className="radar" role="img" aria-label="Skill strengths and weaknesses radar">
      <defs>
        {verts.map((a, i) => {
          const b = verts[(i + 1) % verts.length];
          return (
            <linearGradient
              key={i}
              id={`rg-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            >
              <stop offset="0" stopColor={a.color} />
              <stop offset="1" stopColor={b.color} />
            </linearGradient>
          );
        })}
      </defs>
      {rings}
      {items.map((_, index) => {
        const [x, y] = point(index, 1);
        return <line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke="#1c2735" strokeWidth={1} />;
      })}
      {verts.map((a, i) => {
        const b = verts[(i + 1) % verts.length];
        return (
          <polygon
            key={`f${i}`}
            points={`${cx},${cy} ${a.x},${a.y} ${b.x},${b.y}`}
            fill={`url(#rg-${i})`}
            fillOpacity={0.26}
            stroke="none"
          />
        );
      })}
      {verts.map((a, i) => {
        const b = verts[(i + 1) % verts.length];
        return (
          <line
            key={`e${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={`url(#rg-${i})`}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}
      {verts.map((v, i) => (
        <circle key={`d${i}`} cx={v.x} cy={v.y} r={3.8} fill={v.color} stroke="#0b1019" strokeWidth={1} />
      ))}
      {items.map((item, index) => {
        const [x, y] = point(index, 1.14);
        const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
        return (
          <text
            key={item.label}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="10"
            fill="#9fb0c0"
          >
            {`${item.label} (${item.value || 0})`}
          </text>
        );
      })}
    </svg>
  );
}
