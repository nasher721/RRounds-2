# Preflight contract: cache and quarantine retention

Status: `BLOCKED-PREFLIGHT`; numeric limits require named retention approval.

Proposed finite defaults, requiring approval: fixture directory 250 MB/7 days;
Yjs document 5 MB/7 days; RxDB namespace 50 MB/7 days; unacknowledged queue age
24 hours; local pilot storage 100 MB; quarantine 30 days with day-14 review.
Sign-out, expiry, and account switch clear owner-scoped pilot state through the
existing transition cleanup path. Failed or uncertain recovery is read-only
quarantine and is never purged by age alone. Retention owner: `UNASSIGNED`.
