# Release Checklist

Use this before shipping, sharing, demoing, or handing off a product version. Keep it practical and proportional to the product stage.

## Product

- [ ] V1 scope is clear in `docs/v1-scope.md`.
- [ ] The current version supports the core user promise in `PRODUCT.md`.
- [ ] Known non-goals have not drifted into the release.
- [ ] Important product decisions are recorded in `DECISIONS.md`.

## Functionality

- [ ] The core workflow works from start to finish.
- [ ] Empty states are handled.
- [ ] Error states are handled.
- [ ] Permission or access-denied states are handled, if relevant.
- [ ] Data persists correctly, if persistence is part of the product.
- [ ] Offline or restart behavior has been checked, if relevant.

## Quality

- [ ] The app or package builds successfully.
- [ ] The lightest useful test or smoke check passes.
- [ ] No obvious console errors or crash paths remain.
- [ ] Basic accessibility has been checked for important controls.
- [ ] UI text is clear and product-appropriate.

## Security And Privacy

- [ ] No secrets, tokens, private keys, or local credentials are committed.
- [ ] `.env.example` documents required local configuration, if any.
- [ ] External services or SDKs are listed in `ARCHITECTURE.md`.
- [ ] User data handling is clear and appropriate for the product stage.

## Documentation

- [ ] `README.md` explains how to run or use the product.
- [ ] `TASKS.md` reflects remaining work.
- [ ] `PLANNER.md` includes current handoff context.
- [ ] `DECISIONS.md` includes durable decisions from this release.
- [ ] Known risks or gaps are documented before handoff.

## Final Handoff

- [ ] Summarize what changed.
- [ ] Summarize what was verified.
- [ ] List what remains.
- [ ] Name known risks.
- [ ] Recommend the next task.
