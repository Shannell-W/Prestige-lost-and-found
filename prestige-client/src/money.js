// KSh amounts as the website shows them: "KSh 1,500" or "KSh 99.50".
export function ksh(amount) {
  const n = Number(amount || 0);
  return `KSh ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
