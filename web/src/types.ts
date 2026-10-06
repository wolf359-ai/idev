export type Role = "coach" | "staff" | "player";

export type Capabilities = {
  admin: boolean;
  content: boolean;
  view_all: boolean;
};

export type Session = {
  authenticated: boolean;
  role?: Role;
  csrf?: string;
  access_level?: string;
  staff_name?: string;
  player?: { id: string; name: string } | null;
  can?: Capabilities;
};

export type PlayerSummary = {
  id: string;
  name: string;
  username?: string;
  position?: string;
  secondary_position?: string;
  team_year?: string;
  grad_year?: string;
  team_type?: string;
  number?: number | null;
  exit_velo?: number | "" ;
  base_time?: number | "";
  pitch_velo?: number | "";
  throw_speed?: number | "";
  distance?: number | "";
  has_login?: boolean;
  created_at?: string;
};

export type HistoryPoint = {
  score: number;
  created_at: string;
};

export type ProgressItem = {
  skill_id: string;
  skill_name: string;
  current: number | null;
  first: number | null;
  delta: number | null;
  history: HistoryPoint[];
};

export type Note = {
  id: string;
  text: string;
  category?: string;
  created_at?: string;
};

export type Drill = {
  id: string;
  name: string;
  frequency?: string;
  link?: string;
  created_at?: string;
};

export type Activity = {
  id: string;
  text: string;
  created_at?: string;
};

export type RecordItem = {
  metric?: string;
  label?: string;
  unit?: string;
  delta?: number;
  value?: number;
  created_at?: string;
  higher_better?: boolean;
};

export type StatItem = {
  key: string;
  abbr: string;
  label: string;
  kind: "count" | "computed";
  value: number | null;
  display: string;
};

export type PlayerDetail = PlayerSummary & {
  ratings?: unknown[];
  notes?: Note[];
  activity?: Activity[];
  drills?: Drill[];
  records?: RecordItem[];
  progress?: ProgressItem[];
  stats?: {
    offense?: StatItem[];
    defense?: StatItem[];
    counts?: Record<string, number>;
    computed?: Record<string, number | null>;
  };
};

export type StaffMember = {
  id: string;
  name: string;
  username?: string;
  role: string;
  contact?: string;
  access_level: string;
  has_password?: boolean;
  created_at?: string;
};

export type TeamInfo = {
  name?: string;
  year?: string;
  season?: string;
  age_bracket?: string;
  play_year?: string;
};

export type Alarm = {
  id: string;
  text: string;
  target?: string;
  target_name?: string;
  created_at?: string;
  read?: boolean;
};

export type Message = {
  id: string;
  body: string;
  audience?: string;
  recipient_id?: string | null;
  recipient_name?: string;
  created_at?: string;
  read?: boolean;
};

export type ImportResult = {
  preview?: boolean;
  players?: PlayerSummary[];
  imported?: PlayerSummary[];
  skipped?: { reason?: string }[];
};

export type PlayerTab = "skills" | "stats" | "notes" | "drills" | "progress";

export type AdminPanel = "home" | "add-player" | "import" | "staff" | "team";

export type Screen =
  | { name: "roster" }
  | { name: "player"; id: string; tab: PlayerTab }
  | { name: "alarms" }
  | { name: "messages" }
  | { name: "admin"; panel: AdminPanel };
