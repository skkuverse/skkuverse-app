export function floorBadge(name: string): string {
  const krBasement = name.match(/지하\s*(\d+)/);
  if (krBasement) return `B${krBasement[1]}`;
  const enBasement = name.match(/^B(\d+)$/i);
  if (enBasement) return `B${enBasement[1]}`;
  const num = name.match(/(\d+)/);
  if (num) return `${num[1]}F`;
  return name.length > 3 ? name.substring(0, 3) : name;
}
