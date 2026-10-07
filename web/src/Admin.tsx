import { FormEvent, useEffect, useState } from "react";
import { api } from "./api";
import { ACCESS_LEVELS, AGE_BRACKETS, PLAY_YEARS, SEASONS, TEAM_TYPES } from "./constants";
import type { AdminPanel, PlayerSummary, StaffMember, TeamInfo } from "./types";
import { ErrorNote, Field, FormActions, Panel } from "./ui";
import { PositionFields } from "./Player";

export function AdminScreen({
  panel,
  onPanel,
  onRosterChange,
}: {
  panel: AdminPanel;
  onPanel: (panel: AdminPanel) => void;
  onRosterChange: () => void;
}) {
  if (panel === "add-player") {
    return <AddPlayer onBack={() => onPanel("home")} onSaved={onRosterChange} />;
  }
  if (panel === "import") {
    return <ImportRoster onBack={() => onPanel("home")} onSaved={onRosterChange} />;
  }
  if (panel === "staff") {
    return <StaffAdmin onBack={() => onPanel("home")} />;
  }
  if (panel === "team") {
    return <TeamAdmin onBack={() => onPanel("home")} onSaved={onRosterChange} />;
  }
  return (
    <Panel title="Admin" hint="Roster, staff, and team setup.">
      <div className="stack">
        <button type="button" className="btn primary" onClick={() => onPanel("add-player")}>
          Add player
        </button>
        <button type="button" className="btn" onClick={() => onPanel("import")}>
          Import roster
        </button>
        <button type="button" className="btn" onClick={() => onPanel("staff")}>
          Staff
        </button>
        <button type="button" className="btn" onClick={() => onPanel("team")}>
          Team information
        </button>
      </div>
    </Panel>
  );
}

function AddPlayer({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: Record<string, string | number | null> = {
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      position: String(data.get("position") || ""),
      secondary_position: String(data.get("secondary_position") || ""),
      number: data.get("number") === "" ? null : Number(data.get("number")),
      team_year: String(data.get("team_year") || ""),
      grad_year: String(data.get("grad_year") || ""),
      team_type: String(data.get("team_type") || ""),
    };
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    if (username || password) {
      body.username = username;
      body.password = password;
    }
    setPending(true);
    setError("");
    try {
      await api.addPlayer(body);
      onSaved();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add player");
    } finally {
      setPending(false);
    }
  }
  return (
    <Panel title="Add player" onBack={onBack}>
      <form onSubmit={submit}>
        <Field label="Name">
          <input name="name" required maxLength={80} />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={120}
            placeholder="name@example.com"
          />
        </Field>
        <PositionFields />
        <Field label="Jersey number">
          <input name="number" type="number" min={0} max={99} />
        </Field>
        <Field label="Team year">
          <input name="team_year" maxLength={20} placeholder="2025" />
        </Field>
        <Field label="Graduation year">
          <input name="grad_year" maxLength={9} placeholder="2028" />
        </Field>
        <Field label="Team type">
          <select name="team_type" defaultValue="">
            <option value="">Choose one</option>
            {TEAM_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <p className="meta">Login is optional. Leave both blank to add the player without sign-in.</p>
        <Field label="Username">
          <input name="username" minLength={3} maxLength={32} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" minLength={4} maxLength={128} autoComplete="new-password" />
        </Field>
        <ErrorNote message={error} />
        <FormActions submitLabel="Save player" pending={pending} onCancel={onBack} />
      </form>
    </Panel>
  );
}

function ImportRoster({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PlayerSummary[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function run(previewMode: boolean) {
    setPending(true);
    setError("");
    try {
      const result = await api.importRoster(text, previewMode);
      if (previewMode) {
        setPreview(result.players || []);
        setSkipped((result.skipped || []).length);
      } else {
        onSaved();
        onBack();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel
      title="Import roster"
      hint="In GameChanger, open Stats and choose Export Stats. The importer reads the # and Roster columns."
      onBack={onBack}
    >
      <Field label="GameChanger CSV">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 200 * 1024) {
              setError("That file is too large.");
              return;
            }
            file.text().then(setText).catch(() => setError("Could not read that file."));
          }}
        />
      </Field>
      <Field label="Or paste roster">
        <textarea
          rows={6}
          maxLength={204800}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
          }}
          placeholder={"#,Roster\n7,Alex Rivera\n21,Jordan Blake"}
        />
      </Field>
      {preview ? (
        <div className="card">
          <strong>
            {preview.length} player{preview.length === 1 ? "" : "s"} ready
          </strong>
          {preview.length ? (
            <ul className="plain">
              {preview.map((player) => (
                <li key={`${player.number}-${player.name}`}>
                  {player.number != null ? `#${player.number} · ` : ""}
                  {player.name}
                  {player.position ? ` · ${player.position}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No new players found.</p>
          )}
          {skipped ? <p className="meta">{skipped} row{skipped === 1 ? "" : "s"} skipped.</p> : null}
        </div>
      ) : null}
      <ErrorNote message={error} />
      <div className="actions">
        {preview && preview.length > 0 ? (
          <button type="button" className="btn primary" disabled={pending} onClick={() => void run(false)}>
            Import {preview.length}
          </button>
        ) : (
          <button type="button" className="btn primary" disabled={pending || !text.trim()} onClick={() => void run(true)}>
            Preview roster
          </button>
        )}
        <button type="button" className="btn" onClick={onBack}>
          Cancel
        </button>
      </div>
    </Panel>
  );
}

function StaffAdmin({ onBack }: { onBack: () => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const payload = await api.staff();
    setStaff(payload.staff);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load staff"));
  }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      name: String(data.get("name") || ""),
      role: String(data.get("role") || ""),
      contact: String(data.get("contact") || ""),
      access_level: String(data.get("access_level") || ""),
    };
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    if (username) body.username = username;
    if (password) body.password = password;
    setError("");
    try {
      await api.addStaff(body);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add staff");
    }
  }

  return (
    <Panel title="Staff" hint="Coaches and helpers. Access level controls what they can change." onBack={onBack}>
      <ErrorNote message={error} />
      <ul className="feed">
        {staff.map((member) => (
          <li key={member.id} className="card">
            <button type="button" className="linkish" onClick={() => setOpenId(openId === member.id ? null : member.id)}>
              <strong>{member.name}</strong>
              <span className="meta">
                {member.role} · {member.access_level}
                {member.username ? ` · ${member.username}` : ""}
              </span>
            </button>
            {openId === member.id ? (
              <StaffEditor
                member={member}
                onError={setError}
                onSaved={async () => {
                  await load();
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <form className="card" onSubmit={add} autoComplete="off">
        <h2>Add staff</h2>
        <Field label="Name">
          <input name="name" required maxLength={80} />
        </Field>
        <Field label="Role">
          <input name="role" required maxLength={60} placeholder="Head Coach" />
        </Field>
        <Field label="Contact">
          <input name="contact" maxLength={120} placeholder="Email or phone" />
        </Field>
        <Field label="Admin access">
          <select name="access_level" required defaultValue="">
            <option value="">Choose one</option>
            {ACCESS_LEVELS.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </Field>
        <Field label="Username">
          <input name="username" minLength={3} maxLength={32} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" minLength={4} maxLength={128} autoComplete="new-password" />
        </Field>
        <button type="submit" className="btn primary">
          Save staff
        </button>
      </form>
    </Panel>
  );
}

function StaffEditor({
  member,
  onSaved,
  onError,
}: {
  member: StaffMember;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api.updateStaff(member.id, {
        contact: String(data.get("contact") || ""),
        username: String(data.get("username") || ""),
        access_level: String(data.get("access_level") || member.access_level),
      });
      const password = String(data.get("password") || "");
      if (password) await api.setStaffPassword(member.id, password);
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update staff");
    }
  }
  return (
    <form onSubmit={save}>
      <Field label="Contact">
        <input name="contact" maxLength={120} defaultValue={member.contact || ""} />
      </Field>
      <Field label="Username">
        <input name="username" maxLength={32} autoCapitalize="none" spellCheck={false} defaultValue={member.username || ""} />
      </Field>
      <Field label="Access">
        <select name="access_level" defaultValue={member.access_level}>
          {ACCESS_LEVELS.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
      </Field>
      <Field label="New password">
        <input name="password" type="password" minLength={4} maxLength={128} autoComplete="new-password" placeholder="Leave blank to keep" />
      </Field>
      <div className="actions">
        <button type="submit" className="btn primary">
          Save
        </button>
        {member.has_password ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              api.clearStaffPassword(member.id).then(onSaved).catch((err: unknown) => {
                onError(err instanceof Error ? err.message : "Could not clear password");
              });
            }}
          >
            Clear password
          </button>
        ) : null}
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (!window.confirm(`Remove ${member.name}?`)) return;
            api.deleteStaff(member.id).then(onSaved).catch((err: unknown) => {
              onError(err instanceof Error ? err.message : "Could not remove staff");
            });
          }}
        >
          Remove
        </button>
      </div>
    </form>
  );
}

function TeamAdmin({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api.team().then((payload) => setTeam(payload.team || {})).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load team");
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: TeamInfo = {
      name: String(data.get("name") || ""),
      year: String(data.get("year") || ""),
      season: String(data.get("season") || ""),
      age_bracket: String(data.get("age_bracket") || ""),
      play_year: String(data.get("play_year") || ""),
    };
    setPending(true);
    setError("");
    try {
      const saved = await api.saveTeam(body);
      setTeam(saved.team);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save team");
    } finally {
      setPending(false);
    }
  }

  if (!team) return <Panel title="Team information" onBack={onBack}><p className="empty">{error || "Loading…"}</p></Panel>;

  return (
    <Panel title="Team information" onBack={onBack}>
      <form onSubmit={submit}>
        <Field label="Team name">
          <input name="name" maxLength={80} defaultValue={team.name || ""} />
        </Field>
        <Field label="Year">
          <input name="year" maxLength={20} defaultValue={team.year || ""} />
        </Field>
        <Field label="Season">
          <select name="season" defaultValue={team.season || ""}>
            <option value="">Choose one</option>
            {SEASONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Age bracket">
          <select name="age_bracket" defaultValue={team.age_bracket || ""}>
            <option value="">Choose one</option>
            {AGE_BRACKETS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Years of play">
          <select name="play_year" defaultValue={team.play_year || ""}>
            <option value="">Choose one</option>
            {PLAY_YEARS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <ErrorNote message={error} />
        <FormActions submitLabel="Save" pending={pending} onCancel={onBack} />
      </form>
    </Panel>
  );
}
