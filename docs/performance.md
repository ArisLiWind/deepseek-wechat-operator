# Performance Notes

## What matters in this product

The hard performance problem is not raw token speed alone.

It is keeping the user's accessible WeChat surface:

- ingestible in near real time
- deduplicated before model work
- ranked before full summarization
- small enough that the model sees signal, not noise

## Current implementation

- Event ingestion is append-and-flush JSON persistence
- Ranking is local and deterministic before any model turn
- Reply eligibility depends on locally cached `context_token`
- Digest generation is synchronous over normalized items

## Complexity

- Ingest: `O(k)` over new items in one event
- Search: `O(n)` over accessible items
- Daily digest: `O(n log n)` because items are scored then sorted

For an early product, this is acceptable and intentionally simple.

## Production-minded next steps

- move persistence to SQLite or Postgres once volume increases
- build embedding-backed semantic retrieval for cross-message lookup
- pre-compute per-user reply priority features
- incrementally maintain daily digest candidates instead of full re-sorts
- separate hot token cache from cold historical storage

## Why this is still practical now

Most users do not need a model over every raw message.

They need a ranking layer that shrinks hundreds of noisy objects into a small high-value shortlist before the expensive model work happens.

