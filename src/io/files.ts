/** Minimal typings for the File System Access API (not in the default TS DOM lib). */
interface WritableHandle {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
export interface FileHandle extends WritableHandle {
  name: string;
  getFile(): Promise<File>;
}
interface PickerWindow {
  showOpenFilePicker?: (opts: unknown) => Promise<FileHandle[]>;
  showSaveFilePicker?: (opts: unknown) => Promise<FileHandle>;
}

const types = [{ description: 'Office.json project', accept: { 'application/json': ['.json'] } }];
const picker = () => window as unknown as PickerWindow;

export const hasFileAccess = (): boolean => !!picker().showOpenFilePicker && !!picker().showSaveFilePicker;

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Shows the native open dialog. Returns null if cancelled. Only call when hasFileAccess(). */
export async function pickFile(): Promise<{ handle: FileHandle; text: string } | null> {
  try {
    const [handle] = await picker().showOpenFilePicker!({ types });
    return { handle, text: await (await handle.getFile()).text() };
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/**
 * Writes the text to the handle, asking for a location first when there is none (or `saveAs`).
 * Without the File System Access API it downloads the file. Returns the handle used, or null
 * if the user cancelled or a download was made.
 */
export async function saveText(
  text: string,
  handle: FileHandle | null,
  suggestedName: string,
  saveAs = false,
): Promise<{ handle: FileHandle | null; name: string } | null> {
  if (!hasFileAccess()) {
    download(text, suggestedName);
    return { handle: null, name: suggestedName };
  }
  try {
    const target = !handle || saveAs ? await picker().showSaveFilePicker!({ suggestedName, types }) : handle;
    const w = await target.createWritable();
    await w.write(text);
    await w.close();
    return { handle: target, name: target.name };
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
