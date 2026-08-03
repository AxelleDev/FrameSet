// The CI dependency-audit gate: scoped waivers with expiry, instead of a
// blanket audit-level drop. Tests exercise the pure decision logic against
// synthetic `npm audit --json` shapes.
import { evaluateAudit, collectGatedAdvisories, ALLOWLIST } from '../../scripts/audit-gate.mjs';

const reportWith = (advisories) => ({
  vulnerabilities: Object.fromEntries(
    advisories.map(({ pkg, id, severity, title }, index) => [
      pkg || `pkg-${index}`,
      {
        severity,
        via: [{ url: `https://github.com/advisories/${id}`, severity, title: title || 'x' }],
      },
    ]),
  ),
});

describe('audit gate', () => {
  it('passes when the only advisories are allowlisted and unexpired', () => {
    const report = reportWith([
      { pkg: 'react-router', id: 'GHSA-aaaa-bbbb-cccc', severity: 'high' },
    ]);
    const allowlist = [
      { id: 'GHSA-aaaa-bbbb-cccc', reason: 'not exploitable', expires: '2999-01-01' },
    ];

    const { failures } = evaluateAudit(report, allowlist, new Date('2026-08-03'));

    expect(failures).toEqual([]);
  });

  it('fails on any high/critical advisory that is not allowlisted', () => {
    const report = reportWith([
      { pkg: 'evil-dep', id: 'GHSA-dddd-eeee-ffff', severity: 'critical' },
    ]);

    const { failures } = evaluateAudit(report, [], new Date('2026-08-03'));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('GHSA-dddd-eeee-ffff');
    expect(failures[0]).toContain('not allowlisted');
  });

  it('fails once a waiver expires, forcing a dated re-evaluation', () => {
    const report = reportWith([
      { pkg: 'react-router', id: 'GHSA-aaaa-bbbb-cccc', severity: 'high' },
    ]);
    const allowlist = [
      { id: 'GHSA-aaaa-bbbb-cccc', reason: 'was fine in July', expires: '2026-07-01' },
    ];

    const { failures } = evaluateAudit(report, allowlist, new Date('2026-08-03'));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('EXPIRED');
  });

  it('fails on a stale waiver whose advisory is no longer reported (fix landed)', () => {
    const allowlist = [{ id: 'GHSA-gone-gone-gone', reason: 'old', expires: '2999-01-01' }];

    const { failures } = evaluateAudit({ vulnerabilities: {} }, allowlist, new Date('2026-08-03'));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('remove the entry');
  });

  it('ignores moderate/low advisories and transitive string references', () => {
    const report = {
      vulnerabilities: {
        'some-pkg': {
          severity: 'moderate',
          via: [
            { url: 'https://github.com/advisories/GHSA-mmmm-nnnn-oooo', severity: 'moderate' },
            'other-pkg', // transitive reference, not an advisory object
          ],
        },
      },
    };

    expect(collectGatedAdvisories(report).size).toBe(0);
    expect(evaluateAudit(report, [], new Date()).failures).toEqual([]);
  });

  it('the real allowlist stays scoped: single entry, justified, with a real expiry', () => {
    expect(ALLOWLIST).toHaveLength(1);
    expect(ALLOWLIST[0].id).toBe('GHSA-qwww-vcr4-c8h2');
    expect(ALLOWLIST[0].reason.length).toBeGreaterThan(20);
    expect(ALLOWLIST[0].expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
