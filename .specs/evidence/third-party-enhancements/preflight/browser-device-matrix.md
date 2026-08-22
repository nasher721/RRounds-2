# Preflight contract: browser and device matrix

Status: `BLOCKED-PREFLIGHT`; versions require a named test-infrastructure owner.

| Target | Required run |
| --- | --- |
| Chromium | supported macOS test device; two authenticated contexts for Track B |
| WebKit | same supported macOS test device; two authenticated contexts for Track B |
| Viewport/network | frozen viewport; online, offline, reconnect, throttled, partition, backend failures |
| Storage/auth | quota and local-storage limit; AUTH-A/B/U, revocation/expiry, reload, account switch |
| Mobile/Electron | out of scope unless explicitly added before execution |

Each run records browser/device/OS/tool versions, viewport, network profile,
quota, seed, workload hash, and failure injection. Missing metadata invalidates
the run. Owner/approval: `UNASSIGNED`.
