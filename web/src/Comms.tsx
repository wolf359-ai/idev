import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { formatWhen } from "./format";
import type {
  Alarm,
  AlarmAcknowledgment,
  Capabilities,
  Message,
  PlayerSummary,
  StaffMember,
} from "./types";
import { ErrorNote, Field } from "./ui";

type NoticeItem =
  | { kind: "alarm"; key: string; at: string; alarm: Alarm }
  | { kind: "response"; key: string; at: string; alarm: Alarm; ack: AlarmAcknowledgment };

function notificationItems(alarms: Alarm[], isPlayer: boolean): NoticeItem[] {
  const items: NoticeItem[] = [];
  for (const alarm of alarms) {
    items.push({ kind: "alarm", key: alarm.id, at: alarm.created_at || "", alarm });
    if (isPlayer) continue;
    for (const ack of alarm.acknowledgments || []) {
      items.push({
        kind: "response",
        key: `${alarm.id}:${ack.player_id}`,
        at: ack.acknowledged_at || "",
        alarm,
        ack,
      });
    }
  }
  items.sort((left, right) => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0));
  return items;
}

export function AlarmsScreen({
  can,
  players,
  isPlayer,
  onRead,
}: {
  can: Capabilities;
  players: PlayerSummary[];
  isPlayer: boolean;
  onRead: () => void;
}) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [target, setTarget] = useState("all");
  const [pendingId, setPendingId] = useState("");

  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  async function load() {
    const payload = await api.alarms();
    setAlarms(payload.alarms);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isPlayer) {
          await api.markAlarmsRead();
          onReadRef.current();
        }
        const payload = await api.alarms();
        if (!cancelled) setAlarms(payload.alarms);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load notifications");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlayer]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.addAlarm(text.trim(), target);
      setText("");
      setTarget("all");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add alarm");
    }
  }

  async function acknowledge(id: string) {
    setError("");
    setPendingId(id);
    try {
      await api.acknowledgeAlarm(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not acknowledge");
    } finally {
      setPendingId("");
    }
  }

  const notices = notificationItems(alarms, isPlayer);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h1>Notifications</h1>
          <p className="meta">Practice changes and reminders.</p>
        </div>
      </header>
      <ErrorNote message={error} />
      {can.content ? (
        <form className="card" onSubmit={submit}>
          <Field label="Send to">
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="all">All players</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alarm">
            <textarea
              required
              maxLength={500}
              rows={2}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Practice moved to 5pm Thursday."
            />
          </Field>
          <button type="submit" className="btn primary">
            Add alarm
          </button>
        </form>
      ) : null}
      {notices.length === 0 ? <p className="empty">No notifications.</p> : null}
      <ul className="feed">
        {notices.map((item) =>
          item.kind === "response" ? (
            <li key={item.key} className="card response">
              <p className="meta">Response · {formatWhen(item.ack.acknowledged_at)}</p>
              <p>
                {item.ack.player_name} acknowledged: {item.alarm.text}
              </p>
            </li>
          ) : (
            <li key={item.key} className="card">
              <p className="meta">
                {item.alarm.target_name || "Team"} · {formatWhen(item.alarm.created_at)}
                {item.alarm.read === false ? " · Unread" : ""}
              </p>
              <p>{item.alarm.text}</p>
              {isPlayer ? (
                <div className="actions">
                  {item.alarm.acknowledged ? (
                    <button type="button" className="btn ack-done" disabled>
                      Acknowledged
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={pendingId === item.alarm.id}
                      onClick={() => void acknowledge(item.alarm.id)}
                    >
                      {pendingId === item.alarm.id ? "Acknowledging…" : "Acknowledge"}
                    </button>
                  )}
                </div>
              ) : null}
              {can.content ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    if (!window.confirm("Delete this alarm?")) return;
                    api
                      .deleteAlarm(item.alarm.id)
                      .then(load)
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not delete"));
                  }}
                >
                  Delete
                </button>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

export function MessagesScreen({
  can,
  players,
  isPlayer,
  onRead,
}: {
  can: Capabilities;
  players: PlayerSummary[];
  isPlayer: boolean;
  onRead: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("team");
  const [recipient, setRecipient] = useState("");

  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  async function load() {
    const payload = await api.messages();
    setMessages(payload.messages);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isPlayer) {
          await api.markMessagesRead();
          onReadRef.current();
        }
        const payload = await api.messages();
        if (!cancelled) setMessages(payload.messages);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load messages");
      }
    })();
    if (can.content) {
      api
        .staff()
        .then((payload) => {
          if (!cancelled) setStaff(payload.staff);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [can.content, isPlayer]);

  const needsRecipient = audience === "player" || audience === "staff_member";
  const options = audience === "player" ? players : staff;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.addMessage({
        body: body.trim(),
        audience,
        recipient_id: needsRecipient ? recipient : undefined,
      });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h1>Messages</h1>
          <p className="meta">Notes for the team, staff, or one person.</p>
        </div>
      </header>
      <ErrorNote message={error} />
      {can.content ? (
        <form className="card" onSubmit={submit}>
          <Field label="Send to">
            <select
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value);
                setRecipient("");
              }}
            >
              <option value="team">Entire team</option>
              <option value="staff">All staff</option>
              <option value="player">Specific player</option>
              <option value="staff_member">Specific staff member</option>
            </select>
          </Field>
          {needsRecipient ? (
            <Field label="Recipient">
              <select required value={recipient} onChange={(event) => setRecipient(event.target.value)}>
                <option value="">Choose one</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Message">
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Great effort at practice today."
            />
          </Field>
          <button type="submit" className="btn primary">
            Send message
          </button>
        </form>
      ) : null}
      {messages.length === 0 ? <p className="empty">No messages.</p> : null}
      <ul className="feed">
        {messages.map((message) => (
          <li key={message.id} className="card">
            <p className="meta">
              {message.recipient_name || "Team"} · {formatWhen(message.created_at)}
              {message.read === false ? " · Unread" : ""}
            </p>
            <p>{message.body}</p>
            {can.content ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (!window.confirm("Delete this message?")) return;
                  api
                    .deleteMessage(message.id)
                    .then(load)
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not delete"));
                }}
              >
                Delete
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
