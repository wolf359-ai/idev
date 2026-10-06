import { useMemo, useState } from "react";
import { positionLabel } from "./format";
import type { PlayerSummary } from "./types";

export function RosterScreen({
  players,
  onOpen,
}: {
  players: PlayerSummary[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((player) => {
      const hay = `${player.name} ${player.position || ""} ${player.number ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [players, query]);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h1>Players</h1>
          <p className="meta">{players.length} on the roster</p>
        </div>
      </header>
      <input
        className="search"
        type="search"
        placeholder="Search name, position, or number"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search players"
      />
      {shown.length === 0 ? (
        <p className="empty">
          {players.length === 0
            ? "Add a player from Admin to start tracking skills, ratings, and notes."
            : "No players match that search."}
        </p>
      ) : (
        <ul className="roster">
          {shown.map((player) => (
            <li key={player.id}>
              <button type="button" className="roster-item" onClick={() => onOpen(player.id)}>
                <span className="jersey">{player.number ?? "–"}</span>
                <span>
                  <strong>{player.name}</strong>
                  <span className="meta">{positionLabel(player) || "No position"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
