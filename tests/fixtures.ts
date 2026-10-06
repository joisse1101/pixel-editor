import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
