import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseOfficeJson } from '../src/model/office';
import { decodePng, dataUrlToBytes } from '../src/model/pngCodec';
import type { Project } from '../src/model/types';

const officeDir = resolve(__dirname, '..', 'office');

export function loadOfficeJson(): unknown {
  return JSON.parse(readFileSync(resolve(officeDir, 'Office.json'), 'utf8'));
}

export function loadMapJson(): any {
  return JSON.parse(readFileSync(resolve(officeDir, 'map.json'), 'utf8'));
}

export function loadSpritesheetPng(): Buffer {
  return readFileSync(resolve(officeDir, 'spritesheet.png'));
}

/** The sample project with every sheet's exact pixels decoded, as the browser loader does. */
export async function loadSampleProject(): Promise<Project> {
  const project = parseOfficeJson(loadOfficeJson());
  for (const s of project.sheets) s.pixels = await decodePng(dataUrlToBytes(s.dataUrl));
  return project;
}
