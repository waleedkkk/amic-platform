export function getTypingUnits(content: string): string[] {
  return Array.from(content);
}

export function getTypingPreview(content: string, visibleUnits: number): string {
  return getTypingUnits(content)
    .slice(0, Math.max(0, visibleUnits))
    .join("");
}

export function getTypingInterval(content: string): number {
  if (content.length > 800) return 5;
  if (content.length > 300) return 8;
  return 12;
}
