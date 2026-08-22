# Preflight contract: Yjs WebSocket boundary

Status: `BLOCKED-PREFLIGHT`; no service or endpoint has been approved.

Use a disposable local non-production test service unless a named owner later
approves another non-production boundary. The stock Yjs server is transport
only and is not authorization. Before execution record owner, endpoint
allowlist, session-authenticated upgrade, exact-scope authorization before
`handleUpgrade`, restart/epoch control, size/rate limits, redacted logs, and
bounded teardown. IDs are server-issued and opaque; URLs/logs contain no token,
patient ID, note text, or CRDT update. AUTH-U, stale IDs, and expired sessions
must be rejected before upgrade. Owner/endpoint/approval: `UNASSIGNED`.
