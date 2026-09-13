# Scenario authoring

## Adding a scenario

1. Copy `src/data/aphasiaIntakeScenario.ts`.
2. Give the scenario a new `id` and `version`.
3. Keep the client explicitly `fictional: true`.
4. Provide at least eight decision nodes.
5. Each node needs exactly three options: `high`, `partial`, `inappropriate`.
6. Option texts should be similar in length and must not reveal the best answer visually.
7. Set `nextNodeId` to another node id or `conclusion`.
8. Award only the competencies listed on the node, using `0`, `0.5` or `1`.
9. Add conclusion fields with the same three quality levels.
10. Point the app to the new scenario module and run `npm run verify`.

Do not put scoring rules inside React components.

## Updating a scenario version

1. Increase `SCENARIO_VERSION` using Semantic Versioning.
2. Increase `RUBRIC_VERSION` when scoring weights or awards change.
3. Saved results keep the scenario and rubric version of the attempt that produced them.
4. Older stored results remain readable; they are not rescored.
5. If the storage document shape changes, increase `STORAGE_SCHEMA_VERSION` and extend `parseStoragePayload`. Unsupported schemas are discarded safely.

## Determinism

Do not randomise option order unless a test seed is provided. This project uses a fixed visual order that varies by node so the best answer is not always first.
