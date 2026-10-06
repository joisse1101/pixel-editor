/** Minimal typings for the File System Access API (not in the default TS DOM lib). */
interface WritableHandle {
  createWritable(): Promise<{ write(data: string | Uint8Array): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
}
export interface FileHandle extends WritableHandle {
  name: string;
  getFile(): Promise<File>;
}
interface PickerWindow {
  showOpenFilePicker?: (opts: unknown) => Promise<FileHandle[]>;
  showSaveFilePicker?: (opts: unknown) => Promise<FileHandle>;
}
type PickerTypes = { description: string; accept: Record<string, string[]> }[];

const jsonTypes: PickerTypes = [{ description: 'Office.json project', accept: { 'application/json': ['.json'] } }];
const pngTypes: PickerTypes = [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }];
const picker = () => window as unknown as PickerWindow;

export const hasFileAccess = (): boolean => !!picker().showOpenFilePicker && !!picker().showSaveFilePicker;

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Shows the native open dialog. Returns null if cancelled. Only call when hasFileAccess(). */
export async function pickFile(): Promise<{ handle: FileHandle; text: string } | null> {
  try {
    const [handle] = await picker().showOpenFilePicker!({ types: jsonTypes });
    return { handle, text: await (await handle.getFile()).text() };
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/** Shows the native open dialog for an image. Returns null if cancelled. Only call when hasFileAccess(). */
export async function pickImage(): Promise<{ handle: FileHandle; bytes: Uint8Array; name: string } | null> {
  try {
    const [handle] = await picker().showOpenFilePicker!({ types: pngTypes });
    const file = await handle.getFile();
    return { handle, bytes: new Uint8Array(await file.arrayBuffer()), name: file.name };
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/**
 * Writes the data to the handle, asking for a location first when there is none (or `saveAs`).
 * Without the File System Access API it downloads the file. Returns the handle used, or null
 * if the user cancelled.
 */
async function save(
  data: string | Uint8Array,
  handle: FileHandle | null,
  suggestedName: string,
  saveAs: boolean,
  types: PickerTypes,
  mime: string,
): Promise<{ handle: FileHandle | null; name: string } | null> {
  if (!hasFileAccess()) {
    downloadBytes(data, suggestedName, mime);
    return { handle: null, name: suggestedName };
  }
  try {
    const target = !handle || saveAs ? await picker().showSaveFilePicker!({ suggestedName, types }) : handle;
    const w = await target.createWritable();
    try {
      await w.write(data);
      await w.close();
    } catch (err) {
      await w.abort?.().catch(() => {}); // release the file lock and drop the temp swap file
      throw err;
    }
    return { handle: target, name: target.name };
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

export const saveText = (text: string, handle: FileHandle | null, suggestedName: string, saveAs = false) =>
  save(text, handle, suggestedName, saveAs, jsonTypes, 'application/json');

export const saveBytes = (bytes: Uint8Array, handle: FileHandle | null, suggestedName: string, saveAs = false) =>
  save(bytes, handle, suggestedName, saveAs, pngTypes, 'image/png');

export function downloadBytes(data: BlobPart | Uint8Array, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadText = (text: string, name: string): void => downloadBytes(text, name, 'application/json');
