import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { AiAnalysis } from '../components/AiAnalysis';
import { navItem, navItemActive, navLabel, navMeta, navList, navMuted } from '../styles/navStyles';

interface PackageInfo {
    name: string;
    version: string;
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
    'ansible-builder': 'Ansible Builder lets you create Execution Environments — container images that package Ansible content along with its dependencies. It reads an execution environment definition file and produces an OCI-compliant container image you can use with ansible-runner or Ansible Automation Platform.',
    'ansible-core': 'The engine that powers Ansible automation. It provides the ansible-playbook, ansible-galaxy, and ansible-doc commands, the module execution framework, and the plugin system that all other tools build on.',
    'ansible-creator': 'A scaffolding tool for bootstrapping new Ansible content projects. It generates standardised directory layouts for collections, roles, and playbooks so you can start writing content immediately with best-practice structure in place.',
    'ansible-dev-environment': 'Manages isolated Python virtual environments tailored for Ansible development. It installs the right combination of dependencies so that linting, testing, and building all work together without version conflicts.',
    'ansible-lint': 'A static analysis tool that checks playbooks, roles, and collections against a comprehensive set of rules. It catches common mistakes, enforces style conventions, and helps you write content that follows Ansible best practices.',
    'ansible-navigator': 'A text-based user interface for running and inspecting Ansible content. It wraps ansible-playbook, ansible-doc, ansible-inventory, and more inside an interactive terminal UI with execution environment support.',
    'ansible-sign': 'Provides content signing and verification for Ansible collections and projects. It uses GPG to create detachable signatures so consumers can verify that content has not been tampered with.',
    'molecule': 'A testing framework for Ansible roles and collections. It creates ephemeral infrastructure (containers, VMs, or cloud instances), applies your content, runs verifiers, and tears everything down — giving you fast, repeatable integration tests.',
    'pytest-ansible': 'A pytest plugin that exposes Ansible modules and inventory as pytest fixtures. It lets you write Python-native tests that exercise Ansible content without writing separate playbooks for verification.',
    'tox-ansible': 'A tox plugin that auto-discovers Ansible collection scenarios and generates tox environments for them. It integrates Molecule, linting, and sanity tests into a single tox run.',
    'ansible-compat': 'A compatibility library used by other tools in the ecosystem. It abstracts away differences between Ansible versions so that tools like molecule and ansible-lint can work across multiple ansible-core releases.',
    'ansible-runner': 'A library and command-line tool for reliably running Ansible content. It provides a stable interface for launching playbooks, handling artifacts, and streaming events — used under the hood by AWX and Automation Platform.',
};

/**
 * Column 2: clickable package list
 */
interface DevToolsListProps {
    selected: string | null;
    onSelect: (name: string) => void;
}

export function DevToolsList({ selected, onSelect }: DevToolsListProps): React.JSX.Element {
    const [packages, setPackages] = useState<PackageInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api.getDevToolsPackages().then((pkgs) => {
            setPackages(pkgs);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div style={navMuted}>Loading dev tools...</div>;

    if (packages.length === 0) {
        return (
            <div style={styles.emptyState}>
                <div style={navMuted}>No ansible-dev-tools packages found.</div>
                <div style={styles.emptyHint}>
                    Install the toolkit in your active Python environment:
                </div>
                <code style={styles.emptyCmd}>pip install ansible-dev-tools</code>
            </div>
        );
    }

    return (
        <div style={navList}>
            {packages.map((pkg) => (
                <button
                    key={pkg.name}
                    style={{ ...navItem, ...(selected === pkg.name ? navItemActive : {}) }}
                    onClick={() => onSelect(pkg.name)}
                >
                    <span style={navLabel}>{pkg.name}</span>
                    <span style={navMeta}>{pkg.version}</span>
                </button>
            ))}
        </div>
    );
}

/**
 * Column 3: tool description page
 */
interface DevToolDetailProps {
    toolName: string;
}

export function DevToolDetail({ toolName }: DevToolDetailProps): React.JSX.Element {
    const description = TOOL_DESCRIPTIONS[toolName]
        ?? 'A component of the Ansible development toolchain. It integrates with other ansible-dev-tools packages to provide a comprehensive development experience for Ansible content creators.';

    return (
        <div style={styles.detail}>
            <code style={styles.detailTitle}>{toolName}</code>
            <p style={styles.detailDesc}>{description}</p>
            <AiAnalysis
                prompt={`Explain the Ansible development tool "${toolName}" in detail. Cover what problems it solves, how to get started with it, common commands or workflows, and how it integrates with other tools in the ansible-dev-tools ecosystem.`}
                label="Learn more with AI"
            />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    emptyState: { display: 'flex', flexDirection: 'column', gap: '4px' },
    emptyHint: { padding: '0 12px', color: 'var(--studio-text-tertiary)', fontSize: 'var(--studio-font-size-xs)' },
    emptyCmd: {
        margin: '0 12px', padding: '6px 10px', background: 'var(--studio-bg-tertiary)', borderRadius: 'var(--studio-radius-sm)',
        fontFamily: 'var(--studio-font-mono)', fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-primary)',
        userSelect: 'text',
    },
    detail: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--studio-font-mono)', fontSize: 'var(--studio-font-size-md)', fontWeight: 600 },
    detailDesc: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-secondary)', lineHeight: 1.6 },
};
