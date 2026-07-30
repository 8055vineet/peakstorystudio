# 0001. Record architecture decisions

## Status

Accepted

## Context

Peak Story Studio is moving from a static frontend to a real commercial platform (see
[the end-to-end platform design spec](../superpowers/specs/2026-07-30-end-to-end-platform-design.md)),
and that move requires a series of platform choices: which backend, which host, whether to
keep the existing Vite SPA or rebuild it, and so on. Until now, decisions like these were made
in conversation between the owner and whoever was implementing at the time, with no durable
record. Once that conversation ends, the reasoning goes with it — a later reader, whether a
new engineer or a future agent session, sees only the resulting code and has to guess why it
looks that way, or worse, assumes it was arbitrary and "fixes" it back to whatever seems more
conventional.

This project is also solo-maintained and worked on across many separate sessions (human and
agent), which makes the problem worse than it would be on a team that at least shares hallway
conversations: there is no one else to ask "why did we do it this way?"

## Decision

Record every architecturally significant decision as a numbered Architecture Decision Record
(ADR) under `docs/adr/`, using sequential four-digit numbers (`0001`, `0002`, ...) and the
heading structure `# NNNN. Title`, `## Status`, `## Context`, `## Decision`, `## Consequences`.

An ADR, once its Status is `Accepted`, is never edited to change its substance. If a later
decision reverses or replaces one, that reversal is written as a new ADR, and the new ADR's
Context names the one it supersedes. The old record stays exactly as it was, marked superseded
by the new one — it remains readable as a historical account of what was believed and chosen
at the time, not silently rewritten to look like the current choice was there all along.

"Architecturally significant" means: it constrains future choices (a platform, a hosting
provider, a language or framework), it is expensive to reverse, or it was made by rejecting a
plausible alternative for a specific reason. Routine implementation choices — which library
function to call, how to name a variable — do not get an ADR.

## Consequences

The project gains an auditable history of platform decisions: a reader in six months (or a
fresh agent session with no memory of this conversation) can open `docs/adr/` and see not just
what was chosen but what was rejected and why, without having to reconstruct it from commit
messages or code archaeology.

The cost is a small amount of writing at the time each decision is made — an ADR takes longer
to produce than simply making the change and moving on. There is also a discipline cost: the
record is only useful if it is kept up at the moment of decision, not backfilled from memory
weeks later once the reasoning has faded, and someone has to notice when a decision is
significant enough to warrant one in the first place.
