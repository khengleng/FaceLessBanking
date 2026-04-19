# Infra Bootstrap

This directory provides a portable deployment baseline for three profiles:

- `local/`: runnable local development stack and scripts.
- `railway/`: test/staging deployment placeholders and operational notes.
- `cloud/`: provider-neutral production placeholders (no provider lock-in yet).
- `shared/`: cross-profile contracts and manifests.

## Principles

- No secrets committed to git.
- Reusable env naming across profiles.
- Start small and explicit; expand only when a profile is activated.
