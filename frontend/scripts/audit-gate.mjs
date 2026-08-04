/**
 * Dependency-audit gate for CI: enforces `npm audit --omit=dev` at HIGH
 * severity, minus an explicit allowlist. Unlike lowering --audit-level (which
 * waives every future advisory too), each waiver here is scoped to one GHSA
 * id, carries its justification, and EXPIRES: past its date the gate fails
 * again, so a "temporary" exception can never silently become permanent.
 *
 * Run: `node scripts/audit-gate.mjs` (used by .github/workflows/ci.yml).
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const ALLOWLIST = [
  {
    id: 'GHSA-qwww-vcr4-c8h2',
    reason:
      'react-router RSC-mode CSRF bypass — not exploitable here: classic BrowserRouter SPA, ' +
      'no React Server Components and no server actions. No patched release exists yet ' +
      '(the only "fix" npm offers is downgrading to 7.11.0).',
    // Re-evaluate by this date: check for a patched react-router release and
    // either upgrade or consciously renew this entry.
    expires: '2026-09-30',
  },
];

const GATED_SEVERITIES = new Set(['high', 'critical']);

// Extracts the GHSA ids of every high/critical advisory from `npm audit
// --json` output (npm v10 shape: vulnerabilities.<pkg>.via[] where direct
// advisories are objects carrying url/severity, and transitive references are
// plain strings to be resolved through their own package entry).
export const collectGatedAdvisories = (auditReport) => {
  const advisories = new Map(); // GHSA id -> { package, severity, title }
  const vulnerabilities = auditReport?.vulnerabilities || {};
  for (const [pkg, info] of Object.entries(vulnerabilities)) {
    for (const via of info?.via || []) {
      if (typeof via !== 'object' || via === null) continue;
      if (!GATED_SEVERITIES.has(via.severity)) continue;
      const match = String(via.url || '').match(/GHSA-[a-z0-9-]+/i);
      if (!match) continue;
      const id = match[0];
      if (!advisories.has(id)) {
        advisories.set(id, { package: pkg, severity: via.severity, title: via.title || '' });
      }
    }
  }
  return advisories;
};

/**
 * Pure decision logic (unit-tested): given the audit report, the allowlist
 * and "now", returns { failures: string[] } — empty means the gate passes.
 */
export const evaluateAudit = (auditReport, allowlist, now = new Date()) => {
  const failures = [];
  const advisories = collectGatedAdvisories(auditReport);
  const allowlistById = new Map(allowlist.map((entry) => [entry.id, entry]));

  for (const [id, advisory] of advisories) {
    const waiver = allowlistById.get(id);
    if (!waiver) {
      failures.push(
        `${advisory.severity.toUpperCase()} advisory ${id} on "${advisory.package}" is not allowlisted: ${advisory.title}`,
      );
    } else if (now > new Date(`${waiver.expires}T23:59:59Z`)) {
      failures.push(
        `Allowlist entry ${id} EXPIRED on ${waiver.expires} — re-evaluate it (upgrade the package, or consciously renew the entry with a new date). Reason on file: ${waiver.reason}`,
      );
    }
  }

  // A waiver for an advisory npm no longer reports is stale: fail so the
  // allowlist shrinks back instead of accumulating dead exceptions.
  for (const entry of allowlist) {
    if (!advisories.has(entry.id)) {
      failures.push(
        `Allowlist entry ${entry.id} no longer matches any reported advisory — the fix landed, remove the entry.`,
      );
    }
  }

  return { failures, advisories };
};

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  // npm audit exits non-zero whenever it finds anything; the JSON on stdout is
  // the real signal, so the exit code is ignored here. Single-string + shell
  // (the command is a constant, nothing user-supplied) so the same line works
  // on Windows (npm.cmd) and on the Linux CI runners.
  const result = spawnSync('npm audit --omit=dev --json', {
    encoding: 'utf8',
    shell: true,
  });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error('audit-gate: could not parse `npm audit --json` output.');
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }

  const { failures, advisories } = evaluateAudit(report, ALLOWLIST);
  const waived = [...advisories.keys()].filter((id) => ALLOWLIST.some((e) => e.id === id));
  if (waived.length > 0) {
    console.log(`audit-gate: ${waived.length} allowlisted advisory(ies): ${waived.join(', ')}`);
  }
  if (failures.length > 0) {
    console.error('audit-gate: FAILED');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log('audit-gate: OK (no non-allowlisted high/critical advisories in production deps).');
}
