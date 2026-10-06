import { FormEvent, useEffect, useState } from "react";
import { api } from "./api";
import { Radar, ScoreDots } from "./charts";
import { NOTE_CATEGORIES, POSITIONS } from "./constants";
import { deltaText, formatWhen, positionLabel, safeHttpUrl } from "./format";
import type { Capabilities, PlayerDetail, PlayerTab, StatItem } from "./types";
import { ErrorNote, Field, FormActions } from "./ui";

const TABS: { id: PlayerTab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "stats", label: "Stats" },
  { id: "notes", label: "Notes" },
  { id: "drills", label: "Drills" },
  { id: "progress", label: "Progress" },
];

export function PlayerScreen({
  playerId,
  tab,
  can,
  onTab,
  onBack,
  showBack,
}: {
  playerId: string;
  tab: PlayerTab;
  can: Capabilities;
  onTab: (tab: PlayerTab) => void;
  onBack: () => void;
  showBack: boolean;
}) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  async function reload() {
    const detail = await api.player(playerId);
    setPlayer(detail);
  }

  useEffect(() => {
    let cancelled = false;
    setPlayer(null);
    setError("");
    api
      .player(playerId)
      .then((detail) => {
        if (!cancelled) setPlayer(detail);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load player");
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (!player) {
    return (
      <section className="panel">
        {showBack ? (
          <button type="button" className="back" onClick={onBack}>
            Back
          </button>
        ) : null}
        <p className="empty">{error || "Loading player…"}</p>
      </section>
    );
  }

  return (
    <section className="panel player">
      <header className="player-head">
        {showBack ? (
          <button type="button" className="back" onClick={onBack}>
            Roster
          </button>
        ) : null}
        <div className="player-title">
          <span className="jersey">{player.number ?? "–"}</span>
          <div>
            <h1>{player.name}</h1>
            <p className="meta">{positionLabel(player)}</p>
          </div>
        </div>
        {can.admin ? (
          <div className="chip-row">
            <button type="button" className="btn" onClick={() => setEditing((open) => !open)}>
              {editing ? "Close edit" : "Edit"}
            </button>
            <button type="button" className="btn" onClick={() => setLoginOpen((open) => !open)}>
              {player.has_login ? "Reset login" : "Set login"}
            </button>
            {player.has_login ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (window.confirm("Remove this player's sign-in?")) {
                    void run(() => api.clearPlayerLogin(player.id).then(() => undefined));
                  }
                }}
              >
                Remove login
              </button>
            ) : null}
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (window.confirm(`Delete ${player.name}?`)) {
                  void api.deletePlayer(player.id).then(onBack).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "Could not delete player");
                  });
                }
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </header>
      <ErrorNote message={error} />
      {editing && can.admin ? (
        <EditPlayer
          player={player}
          onDone={() => {
            setEditing(false);
            void reload();
          }}
          onError={setError}
        />
      ) : null}
      {loginOpen && can.admin ? (
        <LoginForm
          player={player}
          onDone={() => {
            setLoginOpen(false);
            void reload();
          }}
          onError={setError}
        />
      ) : null}
      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "tab on" : "tab"}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "skills" ? (
        <Skills player={player} readOnly={!can.content} onRate={(skillId, score) => run(() => api.rate(player.id, skillId, score).then(() => undefined))} />
      ) : null}
      {tab === "stats" ? (
        <Stats player={player} canEdit={can.admin} onSave={(counts) => run(() => api.saveStats(player.id, counts).then(() => undefined))} />
      ) : null}
      {tab === "notes" ? (
        <Notes player={player} canEdit={can.content} onChange={run} />
      ) : null}
      {tab === "drills" ? (
        <Drills player={player} canEdit={can.content} onChange={run} />
      ) : null}
      {tab === "progress" ? <Progress player={player} /> : null}
    </section>
  );
}

function Skills({
  player,
  readOnly,
  onRate,
}: {
  player: PlayerDetail;
  readOnly: boolean;
  onRate: (skillId: string, score: number) => void;
}) {
  const progress = player.progress || [];
  return (
    <div className="stack skills-list">
      <p className="meta">
        {readOnly
          ? "Your latest rating for each skill (1–5)."
          : "Tap a circle to rate 1–5. Tap the left half for a half point, such as 3.5."}
      </p>
      {progress.map((item) => (
        <article key={item.skill_id} className="card skill">
          <h2>{item.skill_name}</h2>
          <ScoreDots
            value={item.current}
            readOnly={readOnly}
            onRate={(score) => onRate(item.skill_id, score)}
          />
          <p className="meta">{item.current ? `${item.current} / 5` : "—"}</p>
        </article>
      ))}
      <article className="card">
        <h2>Performance profile</h2>
        <Radar
          items={progress.map((item) => ({
            label: item.skill_name,
            value: Number(item.current) || 0,
          }))}
        />
      </article>
    </div>
  );
}

function Stats({
  player,
  canEdit,
  onSave,
}: {
  player: PlayerDetail;
  canEdit: boolean;
  onSave: (counts: Record<string, number>) => void;
}) {
  const offense = player.stats?.offense || [];
  const defense = player.stats?.defense || [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const counts: Record<string, number> = {};
    for (const item of [...offense, ...defense]) {
      if (item.kind !== "count") continue;
      const raw = String(data.get(item.key) ?? "0");
      counts[item.key] = Number(raw);
    }
    onSave(counts);
  }
  if (!canEdit) {
    return (
      <div className="stack">
        <StatRead title="Offense" items={offense} />
        <StatRead title="Defense" items={defense} />
      </div>
    );
  }
  return (
    <form className="stack" onSubmit={submit}>
      <p className="meta">AVG, OBP, SLG, OPS, and FLD% update when you save.</p>
      <StatEdit title="Offense" items={offense} />
      <StatEdit title="Defense" items={defense} />
      <button type="submit" className="btn primary">
        Save stats
      </button>
    </form>
  );
}

function StatRead({ title, items }: { title: string; items: StatItem[] }) {
  return (
    <article className="card">
      <h2>{title}</h2>
      <dl className="stat-grid">
        {items.map((item) => (
          <div key={item.key}>
            <dt>{item.abbr}</dt>
            <dd>{item.display}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function StatEdit({ title, items }: { title: string; items: StatItem[] }) {
  return (
    <article className="card">
      <h2>{title}</h2>
      <div className="stat-edit">
        {items.map((item) =>
          item.kind === "computed" ? (
            <p key={item.key} className="stat-computed">
              <span>{item.abbr}</span>
              <strong>{item.display}</strong>
            </p>
          ) : (
            <label key={item.key} className="field compact">
              <span>{item.abbr}</span>
              <input
                name={item.key}
                type="number"
                min={0}
                max={9999}
                step={item.key === "inn" ? "0.1" : "1"}
                defaultValue={item.value ?? 0}
                aria-label={item.label}
              />
            </label>
          ),
        )}
      </div>
    </article>
  );
}

function Notes({
  player,
  canEdit,
  onChange,
}: {
  player: PlayerDetail;
  canEdit: boolean;
  onChange: (action: () => Promise<void>) => void;
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("focus");
  const notes = player.notes || [];
  return (
    <div className="stack">
      {canEdit ? (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            const next = text.trim();
            if (!next) return;
            onChange(async () => {
              await api.addNote(player.id, next, category);
              setText("");
            });
          }}
        >
          <Field label="Note">
            <textarea
              maxLength={2000}
              rows={3}
              required
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Keep the front shoulder closed on outside pitches."
            />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {NOTE_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn primary">
            Save note
          </button>
        </form>
      ) : null}
      {notes.length === 0 ? <p className="empty">No notes yet.</p> : null}
      {notes.map((note) => (
        <article key={note.id} className="card">
          <p className="meta">
            {note.category === "top" ? "Top" : "Focus"} · {formatWhen(note.created_at)}
          </p>
          <p>{note.text}</p>
          {canEdit ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (window.confirm("Delete this note?")) {
                  onChange(() => api.deleteNote(note.id).then(() => undefined));
                }
              }}
            >
              Delete
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Drills({
  player,
  canEdit,
  onChange,
}: {
  player: PlayerDetail;
  canEdit: boolean;
  onChange: (action: () => Promise<void>) => void;
}) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("");
  const [link, setLink] = useState("");
  const drills = player.drills || [];
  return (
    <div className="stack">
      {canEdit ? (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            onChange(async () => {
              await api.addDrill(player.id, { name: name.trim(), frequency: frequency.trim(), link: link.trim() });
              setName("");
              setFrequency("");
              setLink("");
            });
          }}
        >
          <Field label="Drill name">
            <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Frequency">
            <input maxLength={60} value={frequency} onChange={(event) => setFrequency(event.target.value)} placeholder="3x per week" />
          </Field>
          <Field label="Link">
            <input type="url" maxLength={300} value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://" />
          </Field>
          <button type="submit" className="btn primary">
            Save drill
          </button>
        </form>
      ) : null}
      {drills.length === 0 ? <p className="empty">No drills yet.</p> : null}
      {drills.map((drill) => {
        const href = safeHttpUrl(drill.link);
        return (
          <article key={drill.id} className="card">
            <h2>{drill.name}</h2>
            {drill.frequency ? <p className="meta">{drill.frequency}</p> : null}
            {href ? (
              <a
                className="btn"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  void api.logActivity(player.id, `Reviewed drill: ${drill.name}`).catch(() => undefined);
                }}
              >
                Open link
              </a>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (window.confirm("Delete this drill?")) {
                    onChange(() => api.deleteDrill(player.id, drill.id).then(() => undefined));
                  }
                }}
              >
                Delete
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Progress({ player }: { player: PlayerDetail }) {
  const rated = (player.progress || []).filter((item) => item.current);
  const records = player.records || [];
  const activity = player.activity || [];
  return (
    <div className="stack">
      {rated.length === 0 ? <p className="empty">Rate a skill to start a progress history.</p> : null}
      {rated.map((item) => (
        <article key={item.skill_id} className="card">
          <h2>{item.skill_name}</h2>
          <p className={item.delta && item.delta > 0 ? "delta up" : "delta"}>{deltaText(item.delta)}</p>
          <p className="history">
            {(item.history || []).map((entry) => `${entry.score} (${formatWhen(entry.created_at)})`).join(" → ") ||
              "No history"}
          </p>
        </article>
      ))}
      {records.length ? (
        <article className="card">
          <h2>Personal records</h2>
          <ul className="plain">
            {records.map((record, index) => (
              <li key={`${record.metric}-${index}`}>
                {record.label || record.metric}: {record.delta && record.delta > 0 ? "+" : ""}
                {record.delta} {record.unit}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
      {activity.length ? (
        <article className="card">
          <h2>Drill activity</h2>
          <ul className="plain">
            {activity.map((entry) => (
              <li key={entry.id}>
                {entry.text}
                <span className="meta"> {formatWhen(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  );
}

function EditPlayer({
  player,
  onDone,
  onError,
}: {
  player: PlayerDetail;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      name: String(data.get("name") || ""),
      position: String(data.get("position") || ""),
      secondary_position: String(data.get("secondary_position") || ""),
      number: data.get("number") === "" ? null : Number(data.get("number")),
      grad_year: String(data.get("grad_year") || ""),
      exit_velo: String(data.get("exit_velo") || ""),
      distance: String(data.get("distance") || ""),
      base_time: String(data.get("base_time") || ""),
      pitch_velo: String(data.get("pitch_velo") || ""),
      throw_speed: String(data.get("throw_speed") || ""),
    };
    setPending(true);
    try {
      await api.updatePlayer(player.id, body);
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save player");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <Field label="Name">
        <input name="name" required maxLength={80} defaultValue={player.name} />
      </Field>
      <PositionFields position={player.position} secondary={player.secondary_position} />
      <Field label="Jersey number">
        <input name="number" type="number" min={0} max={99} defaultValue={player.number ?? ""} />
      </Field>
      <Field label="Graduation year">
        <input name="grad_year" maxLength={9} defaultValue={player.grad_year || ""} />
      </Field>
      <Field label="Exit velo (mph)">
        <input name="exit_velo" inputMode="decimal" defaultValue={player.exit_velo ?? ""} />
      </Field>
      <Field label="Distance (feet)">
        <input name="distance" inputMode="decimal" defaultValue={player.distance ?? ""} />
      </Field>
      <Field label="Running speed (seconds)">
        <input name="base_time" inputMode="decimal" defaultValue={player.base_time ?? ""} />
      </Field>
      <Field label="Pitch velocity (mph)">
        <input name="pitch_velo" inputMode="decimal" defaultValue={player.pitch_velo ?? ""} />
      </Field>
      <Field label="Throw speed (mph)">
        <input name="throw_speed" inputMode="decimal" defaultValue={player.throw_speed ?? ""} />
      </Field>
      <FormActions submitLabel="Save changes" pending={pending} onCancel={onDone} />
    </form>
  );
}

export function PositionFields({
  position,
  secondary,
}: {
  position?: string;
  secondary?: string;
}) {
  return (
    <>
      <Field label="Primary position">
        <select name="position" required defaultValue={position || ""}>
          <option value="">Choose one</option>
          {POSITIONS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Secondary position">
        <select name="secondary_position" defaultValue={secondary || ""}>
          <option value="">None</option>
          {POSITIONS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
    </>
  );
}

function LoginForm({
  player,
  onDone,
  onError,
}: {
  player: PlayerDetail;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api.setPlayerLogin(
        player.id,
        String(data.get("username") || ""),
        String(data.get("password") || ""),
      );
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save login");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="card" onSubmit={submit} autoComplete="off">
      <p className="meta">They sign in with this username and password and see only their own development.</p>
      <Field label="Username">
        <input
          name="username"
          required
          minLength={3}
          maxLength={32}
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={player.username || ""}
        />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required minLength={4} maxLength={128} autoComplete="new-password" />
      </Field>
      <FormActions submitLabel="Save login" pending={pending} onCancel={onDone} />
    </form>
  );
}
