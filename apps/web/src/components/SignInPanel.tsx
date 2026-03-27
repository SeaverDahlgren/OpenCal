import { AppLogo } from "./AppLogo";

type SignInPanelProps = {
  loading: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
};

export function SignInPanel({ loading, authError, onSignIn }: SignInPanelProps) {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;

  return (
    <main className="signin">
      <div className="signin__card">
        <AppLogo />
        <h1>Welcome to OpenCal</h1>
        <p className="signin__subtitle">Sign in with the Google account you were invited with.</p>
        {loading ? <p className="signin__helper">Checking for an existing beta session...</p> : null}
        {authError ? <p className="signin__error">{authError}</p> : null}
        {!loading && !authError && supportEmail ? (
          <p className="signin__helper">Need access? Contact {supportEmail}.</p>
        ) : null}
        <button className="button button--primary signin__button" onClick={() => void onSignIn()} disabled={loading}>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
