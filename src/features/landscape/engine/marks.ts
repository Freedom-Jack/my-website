// marks.ts — the boot's performance marks, QA builds only (NEXT_PUBLIC_INK_QA=1). Every call site is guarded by its
// module's own `QA` constant (`QA && mark('…')`), so production compiles them out; the boot profile (the vanguard
// round's spikes/boot-profile.mjs) reads them back as `ink:<name>` marks and lays them against the long tasks.

/** A performance mark `ink:<name>` (QA only; never throws). */
export function mark(name: string, detail?: Record<string, unknown>): void {
  try {
    performance.mark(`ink:${name}`, detail ? { detail } : undefined);
  } catch {
    /* an old browser without mark options: no mark */
  }
}
