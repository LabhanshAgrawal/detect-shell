import fs from 'fs/promises';

export const readFile = fs.readFile;
export const stat = fs.stat;
export const lstat = fs.lstat;
export const readlink = fs.readlink;
export const readdir = fs.readdir;

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
