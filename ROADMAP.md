# Roadmap

This roadmap stabilizes one deterministic evaluation contract before adding more SDKs or management features.

## 0. Foundation

- [ ] Define flag, variant, environment, rule, rollout, context, and configuration version
- [ ] Record the server, storage, SDK language, and repository-shape decisions
- [ ] Add formatting, static checks, focused tests, and CI
- [ ] Specify canonical configuration serialization

## 1. Deterministic evaluation

- [ ] Define boolean and multivariate flag schemas
- [ ] Evaluate ordered attribute rules
- [ ] Implement stable percentage assignment
- [ ] Return evaluation details with reason codes
- [ ] Create a language-neutral conformance fixture suite

## 2. Configuration service and first SDK

- [ ] Create, update, archive, and retrieve flags by environment
- [ ] Publish immutable configuration versions
- [ ] Record an audit history for every change
- [ ] Build one server-side SDK with local caching
- [ ] Define stale-cache and safe-default behavior

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
