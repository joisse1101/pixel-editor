import type { Project } from '../model/types';

/** Decodes every sprite sheet PNG once and keeps the bitmap on the sheet. */
export async function decodeSheets(project: Project): Promise<void> {
  await Promise.all(
    project.sheets.map(async (sheet) => {
      if (sheet.bitmap) return;
      const blob = await (await fetch(sheet.dataUrl)).blob();
      sheet.bitmap = await createImageBitmap(blob);
    }),
  );
}
