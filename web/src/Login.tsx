import { FormEvent, useEffect, useState } from "react";
import { api, setCsrf } from "./api";
import type { Session } from "./types";
import { ErrorNote, Field } from "./ui";

export function LoginScreen({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api.health().catch(() => setOffline(true));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const session = await api.login(username.trim(), password);
      setCsrf(session.csrf);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit} autoComplete="off">
        <img className="logo" src="/static/logo.png" alt="Alpha logo" width="300" height="98" />
        <p className="wordmark">Player development portal</p>
        <p className="meta">Sign in with the username and password your coach gave you.</p>
        {offline ? (
          <p className="error" role="alert">
            The idev server is not running. Start it with python3 app.py, then refresh.
          </p>
        ) : null}
        <Field label="Username">
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <ErrorNote message={error} />
      </form>
    </main>
  );
}
