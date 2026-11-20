export const POSITIONS = [
  "Pitcher",
  "Catcher",
  "First Base",
  "Second Base",
  "Third Base",
  "Shortstop",
  "Left Field",
  "Center Field",
  "Right Field",
  "Utility",
  "DP/Flex",
] as const;

export const TEAM_TYPES = ["10u-1", "10u-2", "12u-1y", "12u-2y", "14u-1y", "14u-2y"] as const;

export const SEASONS = ["Spring", "Summer", "Fall", "Winter"] as const;

export const AGE_BRACKETS = ["10u", "12u", "14u", "16u", "18u"] as const;

export const PLAY_YEARS = ["First year", "Second year"] as const;

export const ACCESS_LEVELS = ["Full", "Manager", "Assistant", "Read-only"] as const;

export const NOTE_CATEGORIES = [
  { value: "focus", label: "Focus" },
  { value: "top", label: "Top" },
] as const;
