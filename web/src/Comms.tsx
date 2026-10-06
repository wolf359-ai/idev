import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { formatWhen } from "./format";
import type { Alarm, Capabilities, Message, PlayerSummary, StaffMember } from "./types";
import { ErrorNote, Field } from "./ui";

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
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load alarms");
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

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h1>Alarms</h1>
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
      {alarms.length === 0 ? <p className="empty">No alarms.</p> : null}
      <ul className="feed">
        {alarms.map((alarm) => (
          <li key={alarm.id} className="card">
            <p className="meta">
              {alarm.target_name || "Team"} · {formatWhen(alarm.created_at)}
              {alarm.read === false ? " · Unread" : ""}
            </p>
            <p>{alarm.text}</p>
            {can.content ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (!window.confirm("Delete this alarm?")) return;
                  api
                    .deleteAlarm(alarm.id)
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
