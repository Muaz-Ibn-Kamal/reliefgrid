import { forbidden } from "./errors";

/** The shared accounts listed on the sign-in page. */
export const DEMO_ACCOUNTS: readonly string[] = [
  "admin@reliefgrid.demo",
  "coordinator@reliefgrid.demo",
  "org@reliefgrid.demo",
  "shelter@reliefgrid.demo",
  "volunteer@reliefgrid.demo",
];

/** DEMO_MODE=true (set on the public deployment) stops visitors from locking everyone else out of the shared accounts. */
export const demoMode = () => process.env.DEMO_MODE === "true";

export function assertDemoAccountEditable(email: string, what: string) {
  if (demoMode() && DEMO_ACCOUNTS.includes(email.toLowerCase())) throw forbidden(`${what} is disabled for the shared demo accounts`);
}
