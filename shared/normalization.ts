export const standardizeSequence = (seq: number[][], targetLength: number) => {
  if (seq.length === 0) {
    return new Array<number[]>(targetLength).fill(new Array(42).fill(0));
  }
  if (seq.length === targetLength) {
    return seq;
  }
  const result: number[][] = [];
  if (seq.length < targetLength) {
    result.push(...seq);
    const last = seq[seq.length - 1];
    while (result.length < targetLength) {
      result.push(last);
    }
  } else {
    const step = (seq.length - 1) / (targetLength - 1);
    for (let i = 0; i < targetLength; i++) {
      result.push(seq[Math.round(i * step)]);
    }
  }
  return result;
};
