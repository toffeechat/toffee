/** "1.2.10" 같은 버전 비교 — a < b면 음수(앱 최소 버전 검사, 2026-10-20). 숫자가 아닌 칸은 0으로 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
