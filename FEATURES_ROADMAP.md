# Features to Build

## 1. Docker, Kubernetes & Deployment

- **Production Dockerfiles** for the frontend and backend: multi-stage builds, small images, non-root users, and health checks.
- **Local Docker Compose** for development dependencies; keep it separate from production configuration. The current Compose file is development-oriented.
- **Kubernetes or Helm deployment** for the app, with TLS ingress, secrets/configuration, resource limits, readiness/liveness probes, rolling updates, and autoscaling.
- Use managed PostgreSQL and OpenSearch for production where possible; add backup and restore procedures.
- **CI/CD pipeline** to run tests, build and scan images, deploy to staging, run database migrations, and promote to production with rollback support.

## 2. Distributed Systems & Reliability

- Add **Redis** for caching, rate limits, and short-lived session or coordination data.
- Use a job queue such as **BullMQ** for email, embedding generation, search indexing, and other work that shouldn’t block API requests.
- Add a **transactional outbox** so order and inventory changes reliably trigger background work.
- Make order creation and external requests **idempotent**; add retries, timeouts, dead-letter handling, and clear failure states.
- Keep the current app as a **modular monolith** initially. Split services only when scaling or ownership needs justify it.
- For production payments and inventory, model the checkout flow as a reliable workflow, including payment failure, stock reservation, and cancellation.

**Implemented baseline:** Redis-backed BullMQ processing, a transactional outbox for
purchase-history events after verified payment, idempotent order/Stripe checkout
requests, server-derived catalog prices, exponential retries, and persisted
dead-letter failure state. Stripe-hosted test-mode Checkout and queued order
confirmation emails captured by local Mailpit are available; live payment settings,
inventory reservation, and production checkout operations remain deferred.

## 3. RAG, AI Frameworks & Tool Calling

- Expand beyond product search with RAG over **FAQs, product manuals, policies, and seller information**.
- Build a document ingestion pipeline with chunking, metadata, access controls, updates/deletions, hybrid keyword-plus-vector retrieval, and reranking.
- Show **citations or source links** in AI answers, and evaluate retrieval quality and answer accuracy with a repeatable test set.
- Put model access behind a provider abstraction so you can switch models, set fallbacks, and track cost and latency.
- Add structured tool schemas, bounded tool execution, permissions, and audit logs. Require user confirmation for consequential actions such as purchases or order changes.
- Persist conversation and agent state so users can resume interrupted chats. Consider a framework such as LangGraph.js if the agent workflow becomes complex.

**Implemented local baseline:** seller/private and shared document ingestion, chunking,
hybrid lexical/vector retrieval, source links in AI responses, and repeatable
retrieval/reference-answer grounding fixtures; configurable OpenAI-compatible model
settings, fallback, token limits, timeouts, usage/cost estimates, and an atomically
reserved optional daily budget; bounded tool arguments, audit records, and explicit
confirmation for order cancellation and ticket creation. Durable conversation resume and a larger, judged
answer-quality evaluation set remain future work.

## 4. MCP, API Integrations & Automation

- Expose selected app capabilities through an **authenticated MCP server**, and optionally connect to trusted MCP servers for approved external tools.
- Keep MCP tools least-privileged: scope access, validate inputs, log actions, and require confirmation for sensitive operations.
- Integrate payment, shipping, inventory, email, and CRM providers through adapters and signed webhooks.
- Add webhook idempotency, retry policies, and delivery status tracking.
- Publish versioned API documentation and add API-key/OAuth access and per-client rate limits where needed.
- Automate workflows such as abandoned-cart reminders, back-in-stock alerts, support-ticket triage, and order-status notifications.

**Implemented local baseline:** authenticated read-only MCP tools for catalog and
shared-document lookup, generic signed/idempotent inbound webhook receipt storage,
Stripe test-mode Checkout with signed event processing, and versioned OpenAPI
documentation. Order-confirmation email delivery through a configurable SMTP
adapter is captured locally by Mailpit. Production payment credentials,
shipping/inventory/CRM providers, provider-specific outbound delivery/retries,
OAuth/API-key client scopes, and automated business workflows remain deferred
until providers and operational requirements are selected.

## 5. Observability & Monitoring

- Instrument the API and background jobs with **OpenTelemetry** traces, metrics, and structured logs.
- Track AI-specific signals: model/tool latency, token usage, cost, failures, retrieval quality, and fallback rates.
- Build dashboards for API health, checkout success, queue backlog, database performance, OpenSearch health, and AI usage.
- Define SLIs/SLOs and alert on error rates, latency, failed jobs, and resource exhaustion. Add error reporting such as Sentry for frontend and backend exceptions.

**Implemented local baseline:** OpenTelemetry API traces and metrics for HTTP, AI,
and background outbox processing; Prometheus scraping; and a provisioned Grafana
dashboard and basic alert rules. Optional Sentry reporting is available for frontend
and backend exceptions, disabled when its DSN is blank, with request data scrubbing.
SLO targets, database/OpenSearch exporters, and production alert delivery are still
outstanding.

Shipping, tax calculation, product enrichment, and currency conversion are not
implemented. Their reserved environment variable names are documentation-only
placeholders, not functional provider integrations.

## Suggested Implementation Order

1. **Production baseline:** secure configuration, Docker images, CI checks, health probes, backups, and deployment pipeline.
2. **Reliability:** queue, Redis where useful, idempotency, retries, and reliable event delivery.
3. **AI quality and safety:** RAG ingestion, citations, evaluation, tool permissions, and cost controls.
4. **Integrations and operations:** payments/shipping/webhooks, MCP, OpenTelemetry, dashboards, and alerts.

## Immediate Production-Hardening Detail

The current Compose setup is for local development, and the API CORS setting in `main.ts` is localhost-specific. Production should use environment-specific origins and managed secrets rather than reusing local configuration.

**Dependency audit update (2026-11-07):** the five previously reported high-severity
backend findings were addressed by upgrading to Prisma 7.10.1 with the PostgreSQL
driver adapter and resolving Multer to 2.5.0. The backend production dependency audit
now reports zero findings. The full backend audit still reports lower-severity
development-tool findings, but no high findings remain. Keep running `npm audit`
before deployment because advisories change over time.
