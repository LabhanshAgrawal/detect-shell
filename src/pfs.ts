import fs from 'fs';
import {promisify} from 'util';

export function readFile(path: string): Promise<Buffer>;
export function readFile(path: string, encoding: string): Promise<string>;
export function readFile(path: string, encoding?: string): Promise<Buffer | string> {
  return promisify(fs.readFile)(path, encoding);
}

export function stat(path: string): Promise<fs.Stats> {
  return promisify(fs.stat)(path);
}

export function lstat(path: string): Promise<fs.Stats> {
  return promisify(fs.lstat)(path);
}

export function readlink(path: string): Promise<string> {
  return promisify(fs.readlink)(path);
}

export async function readdir(path: string): Promise<string[]> {
  return promisify(fs.readdir)(path);
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    const {stat, symbolicLink} = await statLink(path);

    return stat.isDirectory() && symbolicLink?.dangling !== true;
  } catch (error) {
    // Ignore, path might not exist
  }

  return false;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const {stat, symbolicLink} = await statLink(path);

    return stat.isFile() && symbolicLink?.dangling !== true;
  } catch (error) {
    // Ignore, path might not exist
  }

  return false;
}

export async function statLink(path: string): Promise<IStatAndLink> {
  // First stat the link
  let lstats: fs.Stats | undefined;
  try {
    lstats = await lstat(path);

    // Return early if the stat is not a symbolic link at all
    if (!lstats.isSymbolicLink()) {
      return {stat: lstats};
    }
  } catch (error) {
    /* ignore - use stat() instead */
  }

  // If the stat is a symbolic link or failed to stat, use fs.stat()
  // which for symbolic links will stat the target they point to
  try {
    const stats = await stat(path);

    return {stat: stats, symbolicLink: lstats?.isSymbolicLink() ? {dangling: false} : undefined};
  } catch (error) {
    // If the link points to a non-existing file we still want
    // to return it as result while setting dangling: true flag
    if (error.code === 'ENOENT' && lstats) {
      return {stat: lstats, symbolicLink: {dangling: true}};
    }

    throw error;
  }
}

interface IStatAndLink {
  // The stats of the file. If the file is a symbolic
  // link, the stats will be of that target file and
  // not the link itself.
  // If the file is a symbolic link pointing to a non
  // existing file, the stat will be of the link and
  // the `dangling` flag will indicate this.
  stat: fs.Stats;

  // Will be provided if the resource is a symbolic link
  // on disk. Use the `dangling` flag to find out if it
  // points to a resource that does not exist on disk.
  symbolicLink?: {dangling: boolean};
}
