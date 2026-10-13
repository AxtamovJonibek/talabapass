// Dizayndagi (W1) dekorativ 9×9 QR naqshi — o'sha algoritm, o'sha urug' (seed = 11).
function build(): string[] {
  const cells: string[] = [];
  let seed = 11;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const corner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      const on = corner ? !(r % 6 === 1 && c % 6 === 1) : rnd() > 0.5;
      cells.push(on ? "var(--color-ink)" : "var(--color-white)");
    }
  }
  return cells;
}

export const miniQr = build();
