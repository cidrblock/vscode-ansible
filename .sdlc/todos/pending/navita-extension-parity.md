---
title: Navita–Extension feature parity
created: 2026-06-23
status: pending
priority: high
scope: navita
---

# Navita–Extension Feature Parity

Gap analysis comparing Navita's capabilities against the VS Code extension
on the `cidrblock/studio` branch. Items are grouped by domain, ordered by
priority within each section.

## Legend

- **Missing** — feature does not exist in Navita
- **Partial** — feature exists but is incomplete
- **Stub** — setting/IPC exists but is not wired to behavior
- **Arch** — architectural divergence from ADR-010

---

## 1. Skills (Implemented)

Skills are now wired end-to-end: IPC, preload, renderer views (list/detail),
and project facet with badge.

- [x] Skills tree view — browse skills by source / module / skill
      (`SkillsView.tsx` in Navita, backed by `SkillRegistry`)
- [x] Skill search / get / list MCP tools
      (`skill_search`, `skill_list`, `skill_get` via `@ansible/mcp-server` delegation)
- [x] Use skill in chat — copy prompt actions in detail view
- [ ] Skill sources configuration setting
      (`skillSources` in extension, default: ai-forge — needs settings UI)

**Extension files:** `src/views/SkillsProvider.ts`,
`packages/mcp-server/src/tools/skills/`

---

## 2. Collection Sources — Galaxy / GitHub doc browsing (Missing)

The extension can browse plugin docs from Galaxy and GitHub without
installing the collection locally.

- [ ] Galaxy plugin doc browsing
      (extension uses `GalaxyDocsCache` to fetch + render docs blobs)
- [ ] GitHub / SCM plugin doc browsing
      (extension uses `SCMDocsCache` to fetch docs from GitHub repos)

**Extension files:** `src/views/CollectionSourcesProvider.ts`,
`packages/services/src/GalaxyDocsCache.ts`,
`packages/services/src/SCMDocsCache.ts`

---

## 3. Dev Tools lifecycle (Missing)

Navita lists installed dev-tools packages but cannot manage them.

- [ ] Install dev-tools packages
- [ ] Upgrade dev-tools packages

**Extension files:** `src/views/AnsibleDevToolsProvider.ts`
(commands: `ansibleDevToolsPackages.install`, `.upgrade`)

---

## 4. MCP in-process tool completion (Implemented)

`mcpHost.ts` now delegates to `McpToolHandler` from `@ansible/mcp-server`,
giving Navita every tool the extension has (static + dynamic creator/skill).

- [x] All 15 static tools via `McpToolHandler` delegation
- [x] Dynamic `ac_*` creator tools
- [x] Dynamic `skill_*` tools
- [x] MCP tool invoke from UI — "Run (no args)" button for zero-arg tools
- [ ] Build `mcp-stdio-proxy.js` — referenced in config snippets but not in
      `scripts/build.mjs`

**Navita file:** `packages/navita/src/main/mcpHost.ts`

---

## 5. Settings wiring (Stub)

These settings are persisted to `~/.config/ansible-navita/settings.json`
but not consumed by any code path.

- [ ] `githubOrgs` — should be passed to `GitHubCollectionCache` on init
- [ ] `pythonPath` — should be used for env selection fallback
- [ ] `enableChat` — should control chat panel visibility
- [ ] `llmProvider` / `llmModel` — either wire or remove (legacy stubs)

**Navita file:** `packages/navita/src/main/settingsStore.ts`

---

## 6. Playbook enhancements (Missing / Partial)

- [ ] Play-level drill-down — extension shows plays as children of
      playbooks; Navita lists playbooks only
- [ ] Per-playbook config persistence — extension saves run configs to
      `.cache/ansible-environments/`; Navita does not persist
- [ ] Global playbook defaults — extension has a separate defaults panel
- [ ] Expose `extraVars` in playbook config UI — runner supports it but
      the form does not surface the field

**Extension files:** `src/views/PlaybooksProvider.ts`,
`src/services/PlaybooksService.ts`, `src/panels/PlaybookConfigPanel.ts`

---

## 7. Collection refresh UI (Missing)

IPC handler `navita:refresh-collections` exists and works, but the
`CollectionsList` view has no refresh button or pull-to-refresh gesture.

- [ ] Add refresh action to collections list header

**Navita file:** `packages/navita/src/renderer/views/CollectionsList.tsx`

---

## 8. LSP client (Partial — low priority without editor)

Navita spawns the Ansible Language Server as a child process (`lspHost.ts`)
but has no LSP client to consume its capabilities. This is only a gap if
Navita adds an embedded editor.

- [ ] LSP JSON-RPC client bridge (completions, hover, diagnostics)

**Navita file:** `packages/navita/src/main/lspHost.ts`

---

## 9. Vault support (Missing)

The extension provides Ansible Vault encrypt/decrypt (inline selection and
whole-file). This could be exposed as a standalone tool or IPC command in
Navita.

- [ ] Vault encrypt (string / file)
- [ ] Vault decrypt (string / file)

**Extension files:** `src/features/vault.ts`, `src/features/ansibleCfg.ts`

---

## 10. `@ansible/ui` adoption (Arch — ADR-010)

Navita duplicates all domain views (plugin docs, creator forms, playbook
config/progress, EE detail, package detail) instead of consuming shared
components from `@ansible/ui` via the `HostBridge` pattern.

- [ ] Adopt `@ansible/ui` `PluginDocView` (replace custom `PluginDocPanel`)
- [ ] Adopt `@ansible/ui` `CreatorFormView` (replace custom `CreatorCommandForm`)
- [ ] Adopt `@ansible/ui` `PlaybookConfigView` (replace custom `PlaybookDetail`)
- [ ] Adopt `@ansible/ui` `PlaybookProgressView` (replace custom `PlaybookProgress`)
- [ ] Adopt `@ansible/ui` `EEDetailView` (replace custom `EEDetail`)
- [ ] Adopt `@ansible/ui` package detail views
- [ ] Implement Navita `HostBridge` adapter (IPC ↔ `BridgeProvider`)

**ADR:** ADR-010 (shared UI components across hosts)
**Extension bridge:** `src/panels/bridges/VsCodeBridge.ts`

---

## 11. Lightspeed (Intentionally omitted?)

Per ADR, Lightspeed references are being removed from the extension.
Listed here for completeness — likely not a real gap.

- [ ] Confirm Lightspeed is intentionally excluded from Navita

---

## 12. Build / CI gaps

- [x] Navita `tsconfig.json` — fixed to reference `../services`
- [ ] `PythonStandaloneService` is imported from `@ansible/services` but
      may not be exported from its barrel `index.ts`
- [ ] Navita has no automated tests (unit or UI)
- [ ] Navita is not included in any CI workflow

---

## Navita-only features (extension lacks)

These are capabilities Navita has that the extension does not. Not gaps to
close but worth noting for future extension work.

| Feature | Details |
|---|---|
| Standalone Python discovery | `PythonStandaloneService` — no IDE dependency |
| Project manager | Open / switch / recent project list |
| Abbenay AI daemon | gRPC chat, sessions, MCP registration |
| Platform / AAP tab | Placeholder for controller integration |
