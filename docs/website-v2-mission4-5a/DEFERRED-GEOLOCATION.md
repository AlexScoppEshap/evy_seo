# Deferred geographic discovery — inactive

No geolocation permission UI, visitor coordinate collection, nearby-events RPC invocation or recovery job is active in this candidate. The current carousel is the existing bounded upcoming public-event selection (12 records); it does not yet implement the requested Lausanne/Geneva balancing or distance search.

Missions 4.1A/4.1C prepared geographic RPC/recovery SQL and a disabled pilot. Mission 4.1D did not qualify a faithful production-schema clone (NO-GO). No SQL has been approved for production application. Their existing local directories are preserved but deliberately excluded from this commit:

- docs/website-v2-mission4-1a/
- docs/website-v2-mission4-1c/
- docs/website-v2-mission4-1d/

No migration or experimental SQL package is tracked in the checkpoint. The existing .vercelignore also excludes docs from CLI upload packaging. Do not deploy from a broad working-tree upload; use the reviewed Git checkpoint. A later geographic implementation needs its own review and explicit production approval. No Flutter, schema or RLS change is part of Website V2 Preview preparation.
