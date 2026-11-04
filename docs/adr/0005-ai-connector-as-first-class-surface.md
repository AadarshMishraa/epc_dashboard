# ADR-0005: MCP server as a first-class surface (Claude and ChatGPT connectors)

- Status: Accepted (Aadarsh, 2026-11-04)
- Date: 2026-11-04

## Context
Owners should be able to plug the dashboard into their own Claude or ChatGPT. Claude's custom connectors use remote MCP servers; ChatGPT connects to remote MCP servers in Developer Mode (beta; verify current plans and the Apps SDK status in OpenAI's docs before building). Source for Claude requirements: https://claude.com/docs/connectors/building/authentication.md

## Decision
- The AI gateway (P9) is a third front door over the **same service layer** as the web app and REST API. It never bypasses tenancy, RBAC, entitlements or audit.
- **Per-user OAuth 2.0 with PKCE (S256).** The token carries user and tenant. No shared org key. Requirements to meet: `401` with `resource_metadata` pointer, DCR or CIMD for client registration, callback `https://claude.ai/api/mcp/auth_callback`, rotating refresh tokens, discovery and token endpoints answering well under 10 seconds.
- **Tools come from module manifests**, filtered by tenant entitlements and user permissions. Few task-level tools, not CRUD.
- **Modes:** `read` and `draft` only. Drafts need human approval in the dashboard. Money movement, message sending, issuing invoices and deletion are never exposed directly.
- **Trust boundary:** all tool output is untrusted data (lead notes, WhatsApp text, vendor emails can contain instructions). Fields in the never-store list are never returned. Rate limits per user.
- **Tenant admin switch** for AI access; separate read and write scopes; every call audited as "user via client".
- Compliance rule `CMP-30` applies.

## Phasing
MVP: read-only, 6 to 8 tools, OAuth, audit, admin switch. v1: draft tools plus an approval queue. v2: OpenAPI actions for custom GPTs, in-chat UI.

## Consequences
AI access becomes a paid entitlement metered by tool calls. Tool descriptions and annotations are part of the module contract.

## Revisit if
OpenAI or Anthropic change connector auth requirements.
