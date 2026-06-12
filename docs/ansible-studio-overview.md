# Ansible Studio

## What it is

Ansible Studio is a standalone desktop application for Ansible automation content developers. It provides a dedicated workspace for managing projects, environments, collections, playbooks, and execution environments — without requiring VS Code or any specific IDE.

Built on Electron, Studio shares a core domain library (`@ansible/core`) with the existing VS Code extension, ensuring feature parity and a single source of truth for Ansible tooling logic.

## The problem it solves

### IDE fragmentation

The Ansible developer tooling ecosystem has historically been tightly coupled to VS Code. As the editor landscape fragments — with AI-native platforms like Cursor, Windsurf, and Claude Code redefining how developers interact with code — VS Code-specific UI panels (sidebars, webviews, tree views) reach fewer users every quarter. Developers who adopt these new tools lose access to the environment management, collection browsing, execution environment inspection, and playbook execution features that the VS Code extension provides.

### Agent-first workflows need protocol, not UI

Modern development increasingly happens through AI agents, not manual file editing. These agents interact through protocols — MCP (Model Context Protocol) for tool invocation, LSP (Language Server Protocol) for diagnostics and completion. An agent running in Claude Code or a CI pipeline has no access to VS Code's sidebar panels, but it can connect to an MCP server and call structured tools. Studio hosts both the MCP and LSP servers as first-class services, exposing Ansible intelligence to any AI tool that speaks these protocols.

### The "two machine" problem

Automation engineers frequently work across contexts: a local laptop for development, execution environments (containers) for runtime parity, and Ansible Automation Platform (AAP) controllers for production execution. Today, configuring the Python environment, discovering installed collections, and inspecting EE contents requires switching between terminals, browser tabs, and IDE panels. Studio consolidates these into a single spatial interface where projects, environments, and platform connections coexist.

## Architecture

Studio is one package in a monorepo alongside the VS Code extension, sharing the same core services:

```
@ansible/core              Shared domain logic (collections, commands, environments, EEs, creator)
@ansible/language-server   LSP implementation (diagnostics, completion, hover)
@ansible/mcp-server        MCP tool definitions (Ansible-specific agent tools)
@ansible/studio            Electron app (main process, renderer, IPC bridge)
```

The VS Code extension and Studio are sibling consumers of the same core. A fix or feature added to `@ansible/core` benefits both surfaces immediately.

### Key services

| Service | What it does |
|---|---|
| **PythonStandaloneService** | Discovers Python environments (venvs, conda, pyenv, system) without IDE support |
| **CollectionsService** | Indexes installed Ansible collections and their plugins |
| **ExecutionEnvService** | Lists and inspects container-based execution environments |
| **DevToolsService** | Tracks ansible-dev-tools package installation status |
| **CreatorService** | Provides scaffolding commands for new projects, roles, and collections |
| **MCP Host** | Runs the MCP server in-process, exposing Ansible tools to AI agents |
| **LSP Host** | Manages the language server as a child process for editor features |

### Dynamic Miller columns

The UI uses a dynamic Miller columns layout — the same pattern as macOS Finder's column view. Navigation flows left to right: selecting a project reveals its facets (environment, collections, playbooks), selecting a facet reveals its items, selecting an item reveals its detail. Columns grow as needed and scroll horizontally. This avoids the cramped sidebar problem that plagues VS Code's tree views when dealing with deeply nested Ansible content.

## Who it is for

**Automation content developers** who write and test Ansible playbooks, roles, and collections locally. They need environment management, collection discovery, and playbook execution in a tool that works regardless of which editor or AI platform they use.

**Platform engineers** who manage execution environments and need to inspect what's inside an EE (Ansible version, collections, Python packages, system packages) without running ad-hoc container commands.

**AI agent operators** who use CLI-based agents (Claude Code, Cursor agents, custom pipelines) and need a local MCP server that exposes Ansible-specific tools — collection search, plugin documentation, EE inspection, project scaffolding — without running VS Code.

## Why it matters for the business

### Reach beyond VS Code

The VS Code extension is the team's primary distribution channel, but it has a ceiling: only VS Code users see it. Studio extends the same capabilities to every developer regardless of editor choice. As AI-native editors capture market share, Studio ensures the Ansible tooling investment is not stranded on a single platform.

### MCP as a distribution protocol

Every AI coding tool is adopting MCP. Studio's built-in MCP server means Ansible tools are automatically available to Claude Code, Cursor, and any future agent platform that supports the protocol. One integration covers an expanding ecosystem of AI tools. The settings panel generates ready-to-paste configuration snippets for each major tool.

### Foundation for AAP integration

Studio's "Platform" section is designed to connect to Ansible Automation Platform controllers. This creates a bridge between the developer's local workspace and enterprise production infrastructure — job template launching, inventory browsing, and execution event streaming — all from a single desktop app. For organizations running AAP, this closes the gap between "write automation" and "run automation" without leaving the developer's context.

### Shared codebase reduces cost

Studio is not a rewrite. It consumes `@ansible/core` directly. Features land once and ship in both the VS Code extension and the desktop app. The investment in collection indexing, environment discovery, EE inspection, and MCP tools pays dividends across two surfaces with minimal incremental maintenance.
