import { useCallback, useEffect, useState } from "react";
import { AdminScreen } from "./Admin";
import { api, setCsrf } from "./api";
import { AlarmsScreen, MessagesScreen } from "./Comms";
import { unreadCount } from "./format";
import { LoginScreen } from "./Login";
import { PlayerScreen } from "./Player";
import { RosterScreen } from "./Roster";
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
  const [unread, setUnread] = useState({ alarms: 0, messages: 0 });
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
      setUnread({ alarms: 0, messages: 0 });
      return;
    }
    Promise.all([api.alarms(), api.messages()])
      .then(([alarms, messages]) => {
        setUnread({
          alarms: unreadCount(alarms.alarms),
          messages: unreadCount(messages.messages),
        });
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
          <p className="meta">{who}</p>
        </div>
        <button type="button" className="btn tiny" onClick={() => void logout()}>
          Sign out
        </button>
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
        {screen.name === "player" ? (
          <PlayerScreen
            playerId={screen.id}
            tab={screen.tab}
            can={can}
            showBack={can.view_all}
            onTab={(tab) => setScreen({ name: "player", id: screen.id, tab })}
            onBack={() => {
              refreshRoster();
              setScreen({ name: "roster" });
            }}
          />
        ) : null}
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
            current={screen.name === "roster" || screen.name === "player"}
            onClick={() => setScreen({ name: "roster" })}
          />
        ) : (
          <NavButton
            label="Me"
            current={screen.name === "player"}
            onClick={() => ownId && setScreen({ name: "player", id: ownId, tab: "skills" })}
          />
        )}
        <NavButton
          label="Alarms"
          count={unread.alarms}
          current={screen.name === "alarms"}
          onClick={() => setScreen({ name: "alarms" })}
        />
        <NavButton
          label="Messages"
          count={unread.messages}
          current={screen.name === "messages"}
          onClick={() => setScreen({ name: "messages" })}
        />
        {can.admin ? (
          <NavButton
            label="Admin"
            current={screen.name === "admin"}
            onClick={() => setScreen({ name: "admin", panel: "home" })}
          />
        ) : null}
      </nav>
    </div>
  );
}

function NavButton({
  label,
  current,
  count,
  onClick,
}: {
  label: string;
  current: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className={current ? "nav-btn on" : "nav-btn"} aria-current={current ? "page" : undefined} onClick={onClick}>
      <span>{label}</span>
      {count ? <span className="badge">{count > 99 ? "99+" : count}</span> : null}
    </button>
  );
}
