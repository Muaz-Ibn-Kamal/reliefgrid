/**
 * Priority scoring (0-100). Pure functions so they are unit-testable.
 *
 * Incident = severity 35 + affected people 30 + location risk 20 + time since reported 15
 * Request  = urgency 30 + incident severity 15 + affected people 25 + location risk 15 + time since reported 15
 * Affected people is log-scaled: >= 10,000 people earns the full component.
 * Time component grows linearly to a cap of 72 hours, so unattended items rise in the queue.
 */
export type Level = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const scale5 = (v: number) => clamp((v - 1) / 4);
const people = (n: number) => clamp(Math.log10(Math.max(0, n) + 1) / Math.log10(10001));
const age = (since: Date, now: Date) => clamp((now.getTime() - since.getTime()) / 3_600_000 / 72);

export function levelFor(score: number): Level {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function scoreIncident(
  i: { severity: number; affectedPopulation: number; locationRisk: number; reportedAt: Date },
  now = new Date(),
) {
  const score =
    scale5(i.severity) * 35 + people(i.affectedPopulation) * 30 + scale5(i.locationRisk) * 20 + age(i.reportedAt, now) * 15;
  const rounded = Math.round(score * 10) / 10;
  return { score: rounded, level: levelFor(rounded) };
}

export function scoreRequest(
  r: { urgency: number; affectedPeople: number; createdAt: Date },
  ctx: { incidentSeverity?: number | null; locationRisk?: number | null } = {},
  now = new Date(),
) {
  const score =
    scale5(r.urgency) * 30 +
    scale5(ctx.incidentSeverity ?? r.urgency) * 15 +
    people(r.affectedPeople) * 25 +
    scale5(ctx.locationRisk ?? 3) * 15 +
    age(r.createdAt, now) * 15;
  const rounded = Math.round(score * 10) / 10;
  return { score: rounded, level: levelFor(rounded) };
}
