/**
 * Utility function to convert hex color to RGB
 * @param hex - Hex color value
 * @returns - RGB color value
 */
export function hexToRgb(hex: string): string {
  hex = hex.replace(/^#/, '');

  const bigint = Number.parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `${r}, ${g}, ${b}`;
}
