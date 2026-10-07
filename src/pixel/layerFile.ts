import { saveBytes } from '../io/files';
import type { Layer } from './history';
import { encodeImageFile } from './pngFile';

/** The layers that remember the file they were imported from. */
export const linkedCount = (layers: Layer[]): number => layers.filter((l) => l.source).length;

/**
 * Whether the document's own Save may run. With two or more linked layers it stays off until the
 * user has completed Save As (a handle that is a place they saved to, not a file they opened).
 */
export function saveAllowed(layers: Layer[], handle: unknown, handleIsSource: boolean): boolean {
  return linkedCount(layers) < 2 || (handle !== null && !handleIsSource);
}

/** Writes the layer's own pixels, whole and at full opacity, to the file it was imported from. */
export async function saveLayerFile(layer: Layer): Promise<string> {
  const source = layer.source;
  if (!source) throw new Error('This layer has no source file');
  const bytes = await encodeImageFile(layer.px);
  const saved = await saveBytes(bytes, source.handle, source.name, false);
  return saved?.name ?? source.name;
}
