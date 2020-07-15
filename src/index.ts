import { release } from 'os';
import { normalize, basename } from 'path';
import { readFile as _readFile, stat as _stat, Stats } from 'fs';
import { promisify } from 'util';

const readFile = promisify(_readFile);
const stat = promisify(_stat);

const getWindowsShell = () => process.env['comspec'] || 'cmd.exe';

interface IShellDefinition {
  label: string;
  path: string;
}

const isWindows = process.platform === 'win32';
const isMacintosh = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

let _TERMINAL_DEFAULT_SHELL_WINDOWS: string | null = null;
function getSystemShellWindows(): string {
  if (!_TERMINAL_DEFAULT_SHELL_WINDOWS) {
    const isAtLeastWindows10 = isWindows && parseFloat(release()) >= 10;
    const is32ProcessOn64Windows = Object.prototype.hasOwnProperty.call(
      process.env,
      'PROCESSOR_ARCHITEW6432'
    );
    const powerShellPath = `${process.env.windir}\\${
      is32ProcessOn64Windows ? 'Sysnative' : 'System32'
      }\\WindowsPowerShell\\v1.0\\powershell.exe`;
    _TERMINAL_DEFAULT_SHELL_WINDOWS = isAtLeastWindows10 ? powerShellPath : getWindowsShell();
  }
  return _TERMINAL_DEFAULT_SHELL_WINDOWS;
}

let _TERMINAL_DEFAULT_SHELL_UNIX_LIKE: string | null = null;
function getSystemShellUnixLike(): string {
  if (!_TERMINAL_DEFAULT_SHELL_UNIX_LIKE) {
    let unixLikeTerminal = 'sh';
    if (!isWindows && process.env.SHELL) {
      unixLikeTerminal = process.env.SHELL;
      // Some systems have $SHELL set to /bin/false which breaks the terminal
      if (unixLikeTerminal === '/bin/false') {
        unixLikeTerminal = '/bin/bash';
      }
    }
    if (isWindows) {
      unixLikeTerminal = '/bin/bash'; // for WSL
    }
    _TERMINAL_DEFAULT_SHELL_UNIX_LIKE = unixLikeTerminal;
  }
  return _TERMINAL_DEFAULT_SHELL_UNIX_LIKE;
}
/**
 * Gets the detected default shell for the _system_, not to be confused with VS Code's _default_
 * shell that the terminal uses by default.
 * @param p The platform to detect the shell of.
 */
function getSystemShell(p: 'Mac' | 'Linux' | 'Windows'): string {
  if (p === 'Windows') {
    if (isWindows) {
      return getSystemShellWindows();
    }
    // Don't detect Windows shell when not on Windows
    return getWindowsShell();
  }
  // Only use $SHELL for the current OS
  if ((isLinux && p === 'Mac') || (isMacintosh && p === 'Linux')) {
    return '/bin/bash';
  }
  return getSystemShellUnixLike();
}

function getWindowsBuildNumber(): number {
  const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(release());
  let buildNumber = 0;
  if (osVersion && osVersion.length === 4) {
    buildNumber = parseInt(osVersion[3]);
  }
  return buildNumber;
}

async function getShellPathFromRegistry(shellName: string): Promise<string> {
  try {
    const Registry = await import('native-reg');
    const shellPath = Registry.getValue(
      Registry.HKLM,
      `SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${shellName}.exe`,
      ''
    ) as string;
    return shellPath ? shellPath : '';
  } catch (error) {
    return '';
  }
}

async function validateShellPaths(
  label: string,
  potentialPaths: string[]
): Promise<IShellDefinition | undefined> {
  if (potentialPaths.length === 0) {
    return Promise.resolve(undefined);
  }
  const current = potentialPaths.shift()!;
  if (current! === '') {
    return validateShellPaths(label, potentialPaths);
  }
  try {
    const result = await stat(normalize(current));
    if (result.isFile || result.isSymbolicLink) {
      return {
        label,
        path: current
      };
    }
  } catch {
    /* noop */
  }
  return validateShellPaths(label, potentialPaths);
}

async function detectAvailableWindowsShells(): Promise<IShellDefinition[]> {
  // Determine the correct System32 path. We want to point to Sysnative
  // when the 32-bit version of VS Code is running on a 64-bit machine.
  // The reason for this is because PowerShell's important PSReadline
  // module doesn't work if this is not the case. See #27915.
  const is32ProcessOn64Windows = Object.prototype.hasOwnProperty.call(
    process.env,
    'PROCESSOR_ARCHITEW6432'
  );
  const system32Path = `${process.env['windir']}\\${is32ProcessOn64Windows ? 'Sysnative' : 'System32'}`;

  let useWSLexe = false;

  if (getWindowsBuildNumber() >= 16299) {
    useWSLexe = true;
  }

  const expectedLocations: { [key: string]: string[] } = {
    'Command Prompt': [`${system32Path}\\cmd.exe`],
    'Windows PowerShell': [`${system32Path}\\WindowsPowerShell\\v1.0\\powershell.exe`],
    PowerShell: [await getShellPathFromRegistry('pwsh')],
    'WSL Bash': [`${system32Path}\\${useWSLexe ? 'wsl.exe' : 'bash.exe'}`],
    'Git Bash': [
      `${process.env['ProgramW6432']}\\Git\\bin\\bash.exe`,
      `${process.env['ProgramW6432']}\\Git\\usr\\bin\\bash.exe`,
      `${process.env['ProgramFiles']}\\Git\\bin\\bash.exe`,
      `${process.env['ProgramFiles']}\\Git\\usr\\bin\\bash.exe`,
      `${process.env['LocalAppData']}\\Programs\\Git\\bin\\bash.exe`
    ]
    // See #75945
    // Cygwin: [
    // 	`${process.env['HOMEDRIVE']}\\cygwin64\\bin\\bash.exe`,
    // 	`${process.env['HOMEDRIVE']}\\cygwin\\bin\\bash.exe`
    // ]
  };
  const promises: Promise<IShellDefinition | undefined>[] = [];
  Object.keys(expectedLocations).forEach((key) =>
    promises.push(validateShellPaths(key, expectedLocations[key]))
  );
  const shells = await Promise.all(promises);
  return shells.filter((e) => !!e) as IShellDefinition[];
}

async function detectAvailableUnixShells(): Promise<IShellDefinition[]> {
  const contents = await readFile('/etc/shells', 'utf8');
  const shells = contents
    .split('\n')
    .filter((e) => e.trim().indexOf('#') !== 0 && e.trim().length > 0);
  return shells.map((e) => {
    return {
      label: basename(e),
      path: e
    };
  });
}

export function detectAvailableShells(): Promise<IShellDefinition[]> {
  return isWindows ? detectAvailableWindowsShells() : detectAvailableUnixShells();
}
