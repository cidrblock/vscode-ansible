import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildTerminalLine,
    commandLine,
    detectTerminals,
    findOnPath,
    openTerminal,
    parseOpenTerminalRequest,
    quoteArgument,
    resolveTerminal,
    shellQuote,
    templateProblem,
} from '../src/main/terminal';

const temps: string[] = [];

/**
 * Make a throwaway directory that is removed after the test.
 * @returns Absolute path of the directory.
 */
function tempDir(): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-terminal-'));
    temps.push(directory);
    return directory;
}

/**
 * Write an executable shell script.
 * @param directory - Where to write it.
 * @param name - File name.
 * @param body - Script body after the shebang.
 * @returns Absolute path of the script.
 */
function script(directory: string, name: string, body: string): string {
    const file = path.join(directory, name);
    fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    return file;
}

afterEach(() => {
    for (const directory of temps.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('findOnPath', () => {
    it('finds a program in the first directory that has it', () => {
        const first = tempDir();
        const second = tempDir();
        const file = script(second, 'ptyxis', 'exit 0');
        expect(findOnPath('ptyxis', [first, second])).toBe(file);
    });

    it('ignores directories without the program', () => {
        expect(findOnPath('ptyxis', [tempDir()])).toBeUndefined();
    });
});

describe('detectTerminals', () => {
    it('marks the known terminals it can find and leaves the rest', () => {
        const directory = tempDir();
        script(directory, 'ptyxis', 'exit 0');
        const candidates = detectTerminals([directory]);
        const ptyxis = candidates.find((candidate) => candidate.bin === 'ptyxis');
        const konsole = candidates.find((candidate) => candidate.bin === 'konsole');
        expect(ptyxis?.detected).toBe(true);
        expect(konsole?.detected).toBe(false);
    });
});

describe('resolveTerminal', () => {
    it('prefers an explicit setting over detection', () => {
        const resolved = resolveTerminal('myterm -- {command}', [
            { bin: 'ptyxis', template: 'ptyxis -- {command}', detected: true },
        ]);
        expect(resolved.template).toBe('myterm -- {command}');
    });

    it('falls back to the first detected terminal in preference order', () => {
        const resolved = resolveTerminal('', [
            { bin: 'konsole', template: 'konsole -e {command}', detected: false },
            { bin: 'ptyxis', template: 'ptyxis -- {command}', detected: true },
            { bin: 'xterm', template: 'xterm -e {command}', detected: true },
        ]);
        expect(resolved.template).toBe('ptyxis -- {command}');
    });

    it('explains itself when nothing is installed', () => {
        const resolved = resolveTerminal('', []);
        expect(resolved.template).toBeNull();
        expect(resolved.detail).toContain('Settings');
    });
});

describe('templateProblem', () => {
    it('requires the command placeholder', () => {
        expect(templateProblem('ptyxis --working-directory {dir}')).toContain('{command}');
        expect(templateProblem('ptyxis -- {command}')).toBeUndefined();
        expect(templateProblem('   ')).toContain('empty');
    });
});

describe('shellQuote', () => {
    it('survives spaces and quotes', () => {
        expect(shellQuote('/home/me/my project')).toBe("'/home/me/my project'");
        expect(shellQuote("it's")).toBe("'it'\\''s'");
    });
});

describe('buildTerminalLine', () => {
    it('quotes the directory and leaves the command as written', () => {
        const line = buildTerminalLine('ptyxis --working-directory {dir} -- {command}', {
            dir: '/home/me/my project',
            command: "'ansible-playbook' 'site.yml'",
        });
        expect(line).toBe(
            "ptyxis --working-directory '/home/me/my project' -- 'ansible-playbook' 'site.yml'",
        );
    });

    it('drops the directory placeholder when a terminal inherits the cwd', () => {
        expect(buildTerminalLine('xterm -e {command}', { dir: '/tmp', command: 'bash' })).toBe(
            'xterm -e bash',
        );
    });
});

describe('openTerminal', () => {
    it('runs the template and treats a live process as started', async () => {
        const directory = tempDir();
        const recorded = path.join(directory, 'args.txt');
        const terminal = script(directory, 'faketerm', `printf '%s\\n' "$@" > "${recorded}"`);

        const result = await openTerminal({
            dir: directory,
            command: 'echo hello',
            setting: `${terminal} --dir {dir} -- {command}`,
            dirs: [directory],
        });

        expect(result.state).toBe('ready');
        expect(result.command).toContain('echo hello');
        await new Promise((resolve) => setTimeout(resolve, 300));
        const args = fs.readFileSync(recorded, 'utf8').trim().split('\n');
        expect(args).toEqual(['--dir', directory, '--', 'echo', 'hello']);
    });

    it('reports a terminal that rejects the command instead of pretending it opened', async () => {
        const directory = tempDir();
        const terminal = script(directory, 'badterm', 'echo "unknown option" >&2\nexit 3');

        const result = await openTerminal({
            dir: directory,
            command: 'bash',
            setting: `${terminal} {command}`,
            dirs: [directory],
        });

        expect(result.state).toBe('error');
        expect(result.detail).toContain('unknown option');
    });

    it('refuses a template without the command placeholder', async () => {
        const result = await openTerminal({
            dir: tempDir(),
            command: 'bash',
            setting: 'ptyxis --working-directory {dir}',
        });
        expect(result.state).toBe('error');
        expect(result.detail).toContain('{command}');
    });
});

describe('quoteArgument', () => {
    it('leaves ordinary words alone', () => {
        expect(quoteArgument('ansible-playbook')).toBe('ansible-playbook');
        expect(quoteArgument('playbooks/site.yml')).toBe('playbooks/site.yml');
        expect(quoteArgument('--mode')).toBe('--mode');
    });

    it('quotes anything the shell would reinterpret', () => {
        expect(quoteArgument('my playbook.yml')).toBe("'my playbook.yml'");
        expect(quoteArgument('$(id).yml')).toBe("'$(id).yml'");
        expect(quoteArgument("it's.yml")).toBe("'it'\\''s.yml'");
        expect(quoteArgument('')).toBe("''");
    });
});

describe('commandLine', () => {
    it('joins words without touching the safe ones', () => {
        expect(commandLine(['ansible-playbook', 'site.yml'])).toBe('ansible-playbook site.yml');
    });

    it('cannot be broken out of by a hostile file name', () => {
        expect(commandLine(['ansible-playbook', 'x; rm -rf ~.yml'])).toBe(
            "ansible-playbook 'x; rm -rf ~.yml'",
        );
    });
});

describe('parseOpenTerminalRequest', () => {
    it('treats a missing request as a plain shell', () => {
        expect(parseOpenTerminalRequest(undefined)).toEqual({});
        expect(parseOpenTerminalRequest(null)).toEqual({});
    });

    it('keeps a word list and a directory', () => {
        expect(parseOpenTerminalRequest({ argv: ['claude'], dir: '/tmp/project' })).toEqual({
            argv: ['claude'],
            dir: '/tmp/project',
        });
    });

    it('treats an empty word list as no command', () => {
        expect(parseOpenTerminalRequest({ argv: [] })).toEqual({});
    });

    it('rejects words that are not strings', () => {
        const parsed = parseOpenTerminalRequest({ argv: ['claude', 7] });
        expect(parsed).toHaveProperty('error');
    });

    it('accepts a hostile-looking word, because it is quoted on the way out', () => {
        const parsed = parseOpenTerminalRequest({ argv: ['claude; rm -rf ~'] });
        // A single word is still valid: it is quoted on the way out, so the
        // semicolon is part of the command name rather than a second command.
        expect(parsed).toEqual({ argv: ['claude; rm -rf ~'] });
    });

    it('rejects a non-string directory', () => {
        const parsed = parseOpenTerminalRequest({ dir: 3 });
        expect(parsed).toHaveProperty('error');
    });
});
