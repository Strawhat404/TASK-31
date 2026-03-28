# Business Logic Interpretations

1. Recalibration Trigger Boundary
For the "every 8 tests" rule, should the maintenance lock be placed immediately after the 8th completed test in the same bay timeline, or can it be deferred to the next available 15-minute gap if operations are saturated?

2. Recalibration Scope by Equipment Identity
When an analyzer is replaced or swapped, should its test counter follow the physical serial number (asset identity), or reset per logical resource record in the platform?

3. Failed/Cancelled Test Counting
Should failed or aborted emissions attempts count toward the 8-test recalibration threshold, or only finalized successful test runs?

4. Seven-Year Retention Clock Start
For report retention, should the 7-year clock start from inspection completion date, report publication date, or customer acknowledgment date?

5. Tombstone Accessibility Policy
After tombstoning, should authorized roles still be able to recover minimal metadata (for legal traceability), or must all user-facing retrieval paths return only an immutable tombstone reference?
