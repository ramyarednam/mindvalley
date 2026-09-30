export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'prewatch';
}

export function exportFilename(title: string, cutLabel: string, ext: string): string {
  return `${slug(title)}-${slug(cutLabel)}-markers.${ext}`;
}
