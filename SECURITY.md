# Security Policy

## Supported versions

FrameSet is deployed continuously from the `main` branch; only the latest
deployed version is supported.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Instead, use GitHub's private vulnerability reporting: go to the repository's
**Security** tab → **Report a vulnerability**. Reports go directly and privately
to the maintainer.

When reporting, include if possible:

- the affected endpoint, page or component;
- steps to reproduce (a curl command or a short scenario is perfect);
- the impact you believe it has (what an attacker could actually do).

You can expect an acknowledgement within a few days. Please give a reasonable
window to fix the issue before any public disclosure.

## Scope

In scope: the API (`backend/`), the web app (`frontend/`), and the CI/CD
configuration in this repository.

Out of scope: denial-of-service through sheer volume (rate limits are
documented and intentional), reports from automated scanners without a
demonstrated impact, and vulnerabilities exclusively affecting outdated
browsers.
