import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { supabase } from "./api";
import Brand from "./Brand";
export default function Auth({
  onDemo,
  recovery = false,
  onRecovered,
  sessionEnded = false,
}: {
  onDemo: () => void;
  recovery?: boolean;
  onRecovered: () => void;
  sessionEnded?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "password">(
    recovery ? "password" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (recovery) setMode("password");
  }, [recovery]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const redirect = window.location.origin;
      if (mode === "login") {
        const r = await supabase.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
      }
      if (mode === "signup") {
        const r = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect },
        });
        if (r.error) throw r.error;
        setMessage("Check your email to confirm your account, then sign in.");
      }
      if (mode === "reset") {
        const r = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirect + "/?recovery=1",
        });
        if (r.error) throw r.error;
        setMessage(
          "If an account exists, you’ll receive a password reset email.",
        );
      }
      if (mode === "password") {
        const r = await supabase.auth.updateUser({ password });
        if (r.error) throw r.error;
        window.history.replaceState({}, "", "/");
        onRecovered();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand" href="/">
          <Brand />
        </a>
        <div>
          <span className="eyebrow">LESS PAPERWORK. MORE POSSIBILITY.</span>
          <h1>
            Your business,
            <br />
            in balance.
          </h1>
          <p>
            From the first invoice to the last payment.
            <br />A little clarity for your everyday business.
          </p>
          <div className="auth-benefits">
            {[
              "Invoices that look the part",
              "A clear view of who owes what",
              "Your books, wherever you are",
            ].map((t) => (
              <p key={t}>
                <Check size={17} />
                {t}
              </p>
            ))}
          </div>
        </div>
        <small>MADE FOR THE WAY SMALL BUSINESSES WORK</small>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">WELCOME TO OPERVIA</span>
          <h2>
            {mode === "signup"
              ? "A fresh start for your books."
              : mode === "reset"
                ? "Let’s get you back in."
                : mode === "password"
                  ? "Choose a new password."
                  : sessionEnded
                    ? "Let’s finish that invoice."
                    : "Good to have you here."}
          </h2>
          <p>
            {mode === "login"
              ? sessionEnded
                ? "Your session ended while you were working. Sign in and the invoice you had open will still be there."
                : "Sign in to your private business workspace."
              : mode === "signup"
                ? "Create your own private business workspace."
                : "Use a strong password to protect your business."}
          </p>
          {!supabase && (
            <div className="setup-note">
              <ShieldCheck size={22} />
              <div>
                <b>Your workspace is almost ready</b>
                <p>
                  Connect Supabase to enable secure sign-in and cloud saving.
                  You can explore the demo below.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={submit}>
            {mode !== "password" && (
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@business.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 12}
                  placeholder={
                    mode === "login"
                      ? "Your password"
                      : "At least 12 characters"
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            {message && (
              <div role="status" className="success">
                {message}
              </div>
            )}
            <button className="btn primary wide" disabled={!supabase || busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : "Save password"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <button
                  onClick={() => {
                    setMode("reset");
                    setError("");
                    setMessage("");
                  }}
                >
                  Forgot password?
                </button>
                <button
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setMessage("");
                  }}
                >
                  Create an account
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
          {!recovery && (
            <>
              <div className="divider">
                <span>TAKE A LOOK AROUND</span>
              </div>
              <button className="btn secondary wide" onClick={onDemo}>
                Explore the demo <ArrowRight size={17} />
              </button>
              <p className="micro center">
                Sample data only. Demo changes reset when you leave.
              </p>
            </>
          )}
          <div className="auth-security">
            <ShieldCheck size={15} /> Your workspace is private to your account
          </div>
        </div>
      </section>
    </main>
  );
}
