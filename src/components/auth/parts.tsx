import { useId, type ReactNode } from "react";

export const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in is not set up on this site yet. Use your email and password.",
  google_denied: "Google sign-in was cancelled. You can try again or use your email.",
  google_expired: "That Google sign-in took too long or was opened in another browser. Please try again.",
  google_state: "That Google sign-in could not be verified. Please try again.",
  google_exchange: "Google did not accept the sign-in. Please try again in a moment.",
  google_token: "Google's answer could not be verified. Please try again.",
  google_unverified: "Your Google email address is not verified, so it cannot be used here.",
  google_inactive: "This account has been disabled. Contact your System Admin.",
  google_rate: "Too many attempts. Wait a few minutes and try again.",
  google_failed: "Google sign-in failed. Please try again or use your email.",
};

/** A labelled dark-theme field. The input is built by the caller so it can be controlled. */
export function AgField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="ag-field">
      {label}
      {children(id)}
      {hint && !error && <small>{hint}</small>}
      {error && <span role="alert" className="ag-err">{error}</span>}
    </label>
  );
}

/** "Continue with Google". A plain link: the server starts the flow and redirects, so no script is needed. */
export function GoogleButton({ label }: { label: string }) {
  return (
    <a href="/api/auth/google" className="ag-google">
      <span className="ag-g" aria-hidden="true">G</span>
      {label}
    </a>
  );
}
