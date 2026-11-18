/** Tata letak teks struk untuk gambar PNG (canvas), tanpa DOM. */
export function receiptImageLayout(
  text: string,
  columns: number,
  copies: number,
  feedLines: number,
  charWidth: number,
  lineHeight: number,
  padding: number,
): { width: number; height: number; lines: string[] } {
  const lines = text.replace(/\n$/, '').split('\n');
  const body: string[] = [];
  for (let copy = 0; copy < copies; copy += 1) {
    body.push(...lines);
    if (copy < copies - 1) body.push('', '');
  }
  body.push(...Array<string>(feedLines).fill(''));
  return {
    width: columns * charWidth + padding * 2,
    height: body.length * lineHeight + padding * 2,
    lines: body,
  };
}
