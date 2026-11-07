export function unifiedDiff(before: string, after: string, name = "documento"): string {
  const a = before.split("\n");
  const b = after.split("\n");
  const lines = [`--- a/${name}`, `+++ b/${name}`];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      if (left !== undefined) lines.push(" " + left);
    } else {
      if (left !== undefined) lines.push("-" + left);
      if (right !== undefined) lines.push("+" + right);
    }
  }
  return lines.join("\n");
}
