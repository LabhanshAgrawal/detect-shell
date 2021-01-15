import {release} from 'os';
import {normalize, basename} from 'path';
import {platform as _platform, env} from 'process';
import {readFile, stat, lstat} from './pfs';
import {enumeratePowerShellInstallations} from './powershell';

interface IShellDefinition {
  label: string;
  path: string;
}

const platform = {
  isWindows: _platform === 'win32',
  isMacintosh: _platform === 'darwin',
  isLinux: _platform === 'linux'
};

export function getWindowsBuildNumber(): number {
  const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(release());
  let buildNumber: number = 0;
  if (osVersion && osVersion.length === 4) {
    buildNumber = parseInt(osVersion[3]);
  }
  return buildNumber;
}

export function detectAvailableShells(): Promise<IShellDefinition[]> {
  return platform.isWindows ? detectAvailableWindowsShells() : detectAvailableUnixShells();
}

async function detectAvailableWindowsShells(): Promise<IShellDefinition[]> {
  const is32ProcessOn64Windows = env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
  const system32Path = `${env['windir']}\\${is32ProcessOn64Windows ? 'Sysnative' : 'System32'}`;

  let useWSLexe = false;

  if (getWindowsBuildNumber() >= 16299) {
    useWSLexe = true;
  }

  const expectedLocations: {[key: string]: string[]} = {
    'Command Prompt': [`${system32Path}\\cmd.exe`],
    'WSL Bash': [`${system32Path}\\${useWSLexe ? 'wsl.exe' : 'bash.exe'}`],
    'Git Bash': [
      `${env['ProgramW6432']}\\Git\\bin\\bash.exe`,
      `${env['ProgramW6432']}\\Git\\usr\\bin\\bash.exe`,
      `${env['ProgramFiles']}\\Git\\bin\\bash.exe`,
      `${env['ProgramFiles']}\\Git\\usr\\bin\\bash.exe`,
      `${env['LocalAppData']}\\Programs\\Git\\bin\\bash.exe`
    ],
    Cygwin: [
      `${env['HOMEDRIVE']}\\cygwin64\\bin\\bash.exe`,
      `${env['HOMEDRIVE']}\\cygwin\\bin\\bash.exe`
    ]
  };

  // Add all of the different kinds of PowerShells
  for await (const pwshExe of enumeratePowerShellInstallations()) {
    expectedLocations[pwshExe.displayName] = [pwshExe.exePath];
  }

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
    if (result.isFile() || result.isSymbolicLink()) {
      return {
        label,
        path: current
      };
    }
  } catch (e) {
    // Also try using lstat as some symbolic links on Windows
    // throw 'permission denied' using 'stat' but don't throw
    // using 'lstat'
    try {
      const result = await lstat(normalize(current));
      if (result.isFile() || result.isSymbolicLink()) {
        return {
          label,
          path: current
        };
      }
    } catch (e) {
      // noop
    }
  }
  return validateShellPaths(label, potentialPaths);
}
