import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminScreen } from "./Admin";
import { api, setCsrf } from "./api";
import { AlarmsScreen, MessagesScreen } from "./Comms";
import { unacknowledgedCount } from "./format";
import { LoginScreen } from "./Login";
import { PlayerScreen } from "./Player";
import { RosterScreen } from "./Roster";
import { ScheduleScreen } from "./Schedule";
import type { Capabilities, PlayerSummary, Screen, Session, TeamInfo } from "./types";

const EMPTY_CAN: Capabilities = { admin: false, content: false, view_all: false };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    api
      .session()
      .then((next) => {
        setCsrf(next.csrf);
        setSession(next);
      })
      .catch(() => setSession({ authenticated: false }))
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <main className="login">
        <p className="meta">Loading idev…</p>
      </main>
    );
  }
  if (!session?.authenticated) {
    return <LoginScreen onSuccess={setSession} />;
  }
  return (
    <Shell
      session={session}
      onLogout={() => {
        setCsrf("");
        setSession({ authenticated: false });
      }}
    />
  );
}

function Shell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const can = session.can ?? EMPTY_CAN;
  const isPlayer = session.role === "player";
  const ownId = session.player?.id || "";
  const [screen, setScreen] = useState<Screen>(
    isPlayer && ownId ? { name: "player", id: ownId, tab: "skills" } : { name: "roster" },
  );
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [team, setTeam] = useState<TeamInfo>({});
  const [unacknowledged, setUnacknowledged] = useState(0);
  const [rosterError, setRosterError] = useState("");

  const refreshRoster = useCallback(() => {
    if (!can.view_all) return;
    api
      .players()
      .then((payload) => {
        setPlayers(payload.players);
        setRosterError("");
      })
      .catch((err: unknown) => {
        setRosterError(err instanceof Error ? err.message : "Could not load roster");
      });
  }, [can.view_all]);

  const refreshInbox = useCallback(() => {
    if (!isPlayer) {
      setUnacknowledged(0);
      return;
    }
    api
      .alarms()
      .then((payload) => {
        setUnacknowledged(unacknowledgedCount(payload.alarms));
      })
      .catch(() => undefined);
  }, [isPlayer]);

  useEffect(() => {
    refreshRoster();
  }, [refreshRoster]);

  useEffect(() => {
    refreshInbox();
  }, [refreshInbox]);

  useEffect(() => {
    api
      .team()
      .then((payload) => setTeam(payload.team || {}))
      .catch(() => undefined);
  }, []);

  const alarmsCurrent = screen.name === "alarms";
  const playerId = screen.name === "player" ? screen.id : isPlayer && alarmsCurrent ? ownId : "";
  const playerTab = screen.name === "player" ? screen.tab : "skills";
  const teamLabel = [team.name, team.season, team.year].filter(Boolean).join(" · ");
  const who =
    session.role === "coach"
      ? "Coach"
      : session.role === "staff"
        ? [session.staff_name, session.access_level].filter(Boolean).join(" · ")
        : session.player?.name || "Player";

  async function logout() {
    try {
      await api.logout();
    } catch {
      // The local session is cleared either way.
    }
    onLogout();
  }

  return (
    <div className="shell">
      <header className="top">
        <img className="logo" src="/static/logo.png" alt="Alpha logo" />
        <div className="top-copy">
          <p className="brand-title">{teamLabel || "Player development"}</p>
          <div className="who-row">
            <p className="meta">{who}</p>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" className="btn tiny" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="stage">
        {screen.name === "roster" ? (
          <>
            {rosterError ? <p className="error">{rosterError}</p> : null}
            <RosterScreen
              players={players}
              onOpen={(id) => setScreen({ name: "player", id, tab: "skills" })}
            />
          </>
        ) : null}
        {playerId ? (
          <PlayerScreen
            playerId={playerId}
            tab={playerTab}
            can={can}
            showBack={screen.name === "player" && can.view_all}
            unacknowledged={unacknowledged}
            alarmsCurrent={alarmsCurrent}
            headerOnly={alarmsCurrent}
            onAlarms={() => setScreen({ name: "alarms" })}
            onTab={(tab) => {
              if (screen.name === "player") setScreen({ name: "player", id: screen.id, tab });
            }}
            onBack={() => {
              refreshRoster();
              setScreen({ name: "roster" });
            }}
          />
        ) : null}
        {screen.name === "schedule" ? <ScheduleScreen /> : null}
        {screen.name === "alarms" ? (
          <AlarmsScreen can={can} players={players} isPlayer={isPlayer} onRead={refreshInbox} />
        ) : null}
        {screen.name === "messages" ? (
          <MessagesScreen can={can} players={players} isPlayer={isPlayer} onRead={refreshInbox} />
        ) : null}
        {screen.name === "admin" && can.admin ? (
          <AdminScreen
            panel={screen.panel}
            onPanel={(panel) => setScreen({ name: "admin", panel })}
            onRosterChange={() => {
              refreshRoster();
              api.team().then((payload) => setTeam(payload.team || {})).catch(() => undefined);
            }}
          />
        ) : null}
      </main>
      <nav className="nav" aria-label="Primary">
        {can.view_all ? (
          <NavButton
            label="Players"
            icon={<PlayersIcon />}
            current={screen.name === "roster" || screen.name === "player"}
            onClick={() => setScreen({ name: "roster" })}
          />
        ) : (
          <NavButton
            label="Profile"
            icon={<PersonIcon />}
            current={screen.name === "player"}
            onClick={() => ownId && setScreen({ name: "player", id: ownId, tab: "skills" })}
          />
        )}
        <NavButton
          label="Schedule"
          icon={<CalendarIcon />}
          current={screen.name === "schedule"}
          onClick={() => setScreen({ name: "schedule" })}
        />
        <NavButton
          label="Messages"
          icon={<MessagesIcon />}
          current={screen.name === "messages"}
          onClick={() => setScreen({ name: "messages" })}
        />
        {can.admin ? (
          <NavButton
            label="Admin"
            icon={<AdminIcon />}
            current={screen.name === "admin"}
            onClick={() => setScreen({ name: "admin", panel: "home" })}
          />
        ) : null}
      </nav>
    </div>
  );
}

function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.4" cy="8.4" r="1.9" />
        <path d="M1.8 16.6c.4-2.2 2-3.4 3.6-3.4s3.2 1.2 3.6 3.4" />
        <circle cx="18.6" cy="8.4" r="1.9" />
        <path d="M15 16.6c.4-2.2 2-3.4 3.6-3.4s3.2 1.2 3.6 3.4" />
        <circle cx="12" cy="9.1" r="2.2" />
        <path d="M7.2 18.7c.65-2.6 2.4-4 4.8-4s4.15 1.4 4.8 4" />
      </g>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.35" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M7.35 16.85c.65-1.85 2.3-2.9 4.65-2.9s4 .95 4.65 2.9"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4.2" y="5.2" width="15.6" height="14.2" rx="2" />
        <path d="M4.2 9.4h15.6" />
        <path d="M8 3.5v3.2M16 3.5v3.2" />
      </g>
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M7.1 6.7h9.8a2.3 2.3 0 0 1 2.3 2.3v5.1a2.3 2.3 0 0 1-2.3 2.3h-6.4L7.2 19.2v-2.8H7.1a2.3 2.3 0 0 1-2.3-2.3V9a2.3 2.3 0 0 1 2.3-2.3Z"
      />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M4 7.2h3.1M12.4 7.2H20" />
        <path d="M4 12h7.4M16.6 12H20" />
        <path d="M4 16.8h4.6M13.8 16.8H20" />
        <circle cx="9.15" cy="7.2" r="1.95" />
        <circle cx="14.15" cy="12" r="1.95" />
        <circle cx="11.15" cy="16.8" r="1.95" />
      </g>
    </svg>
  );
}

function NavButton({
  label,
  current,
  count,
  icon,
  onClick,
}: {
  label: string;
  current: boolean;
  count?: number;
  icon: ReactNode;
  onClick: () => void;
}) {
  const className = ["nav-btn", label === "Profile" ? "profile" : "", current ? "on" : ""].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={className}
      aria-current={current ? "page" : undefined}
      aria-label={count ? `${label}, ${count} unread` : undefined}
      onClick={onClick}
    >
      <span className="nav-icon">
        {icon}
        {count ? <span className="badge">{count > 99 ? "99+" : count}</span> : null}
      </span>
      <span className="nav-label">{label}</span>
    </button>
  );
}
