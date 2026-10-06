/** Map a tap on rating dot `dot` (1–5) to a score the server accepts. */
export function scoreFromTap(dot: number, leftHalf: boolean): number {
  if (dot <= 1) return 1;
  return leftHalf ? dot - 0.5 : dot;
}

export function scoreLevel(value: number | null | undefined): number {
  if (!value) return 0;
  return Math.max(1, Math.min(5, Math.round(value)));
}

const SCORE_COLORS: Record<number, string> = {
  1: "hsl(352, 85%, 60%)",
  2: "hsl(28, 90%, 58%)",
  3: "hsl(50, 92%, 56%)",
  4: "hsl(96, 62%, 52%)",
  5: "hsl(150, 72%, 50%)",
};

export function scoreColor(value: number | null | undefined): string {
  const level = scoreLevel(value);
  return level ? SCORE_COLORS[level] : "#3a4757";
}

export function formatWhen(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function positionLabel(player: {
  position?: string;
  secondary_position?: string;
}): string {
  const primary = player.position || "";
  const secondary = player.secondary_position || "";
  if (primary && secondary) return `${primary} · ${secondary}`;
  return primary || secondary;
}

export function deltaText(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || delta === 0) return "No change yet";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} from first rating`;
}

/** Allow only http(s) links from the server before using them as hrefs. */
export function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function unreadCount(items: { read?: boolean }[]): number {
  return items.filter((item) => item.read === false).length;
}
