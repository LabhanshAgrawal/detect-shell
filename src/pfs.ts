import {
  readFile as _readFile,
  stat as _stat,
  lstat as _lstat,
  readlink as _readlink,
  readdir as _readdir,
  Stats
} from 'fs';
import {promisify} from 'util';

export function readFile(path: string): Promise<Buffer>;
export function readFile(path: string, encoding: string): Promise<string>;
export function readFile(path: string, encoding?: string): Promise<Buffer | string> {
  return promisify(_readFile)(path, encoding);
}

export function stat(path: string): Promise<Stats> {
  return promisify(_stat)(path);
}

export function lstat(path: string): Promise<Stats> {
  return promisify(_lstat)(path);
}

export function readlink(path: string): Promise<string> {
  return promisify(_readlink)(path);
}

export async function readdir(path: string): Promise<string[]> {
  return promisify(_readdir)(path);
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);

    return fileStat.isDirectory();
  } catch (error) {
    // This catch will be called on some symbolic links on Windows (AppExecLink for example).
    // So we try our best to see if it's a Directory.
    try {
      const fileStat = await stat(await readlink(path));

      return fileStat.isDirectory();
    } catch {
      return false;
    }
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);

    return fileStat.isFile();
  } catch (error) {
    // This catch will be called on some symbolic links on Windows (AppExecLink for example).
    // So we try our best to see if it's a File.
    try {
      const fileStat = await stat(await readlink(path));

      return fileStat.isFile();
    } catch {
      return false;
    }
  }
}
