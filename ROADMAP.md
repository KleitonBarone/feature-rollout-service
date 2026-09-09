# Roadmap

This roadmap stabilizes one deterministic evaluation contract before adding more SDKs or management features.

## 0. Foundation

- [x] Define flag, variant, environment, rule, rollout, context, and configuration version
- [x] Record the server, storage, SDK language, and repository-shape decisions
- [x] Add formatting, static checks, focused tests, and CI
- [x] Specify canonical configuration serialization

## 1. Deterministic evaluation

- [x] Define boolean and multivariate flag schemas
- [x] Evaluate ordered attribute rules
- [x] Implement stable percentage assignment
- [x] Return evaluation details with reason codes
- [x] Create a language-neutral conformance fixture suite

## 2. Configuration service and first SDK

- [ ] Create, update, archive, and retrieve flags by environment
- [ ] Publish immutable configuration versions
- [ ] Record an audit history for every change
- [ ] Build one server-side SDK with local caching
- [ ] Build typed configuration loading and refresh APIs around the evaluator
- [ ] Define SDK stale-cache windows and refresh failure behavior

## 3. Operational proof

- [ ] Stream or poll configuration updates without per-evaluation network calls
- [ ] Add kill-switch behavior and recovery tests
- [ ] Add evaluation and configuration telemetry
- [ ] Test deterministic assignment across processes and releases
- [ ] Publish a rollout demonstration with failure scenarios

## Later, if justified

- [ ] Additional server-side SDKs
- [ ] Client-side SDKs with privacy constraints
- [ ] Approval policies for sensitive flags
- [ ] Experiment exposure events

## Explicitly out of scope for the first release

- Statistical experimentation analysis
- Multi-region replication
- A visual rule builder
- Arbitrary code in targeting rules
