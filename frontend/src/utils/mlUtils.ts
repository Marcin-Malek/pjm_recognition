export const standardizeSequence = (seq: number[][], targetLength: number) => {
  if (seq.length === 0) return new Array(targetLength).fill(new Array(42).fill(0));
  if (seq.length === targetLength) return seq;
  const result: number[][] = [];
  if (seq.length < targetLength) {
    result.push(...seq);
    const last = seq[seq.length - 1];
    while (result.length < targetLength) result.push(last);
  } else {
    const step = (seq.length - 1) / (targetLength - 1);
    for (let i = 0; i < targetLength; i++) {
      result.push(seq[Math.round(i * step)]);
    }
  }
  return result;
};

export const getMirroredStaticData3D = (flatData: number[]) => {
  const mirrored = [];
  const wristX = flatData[0];
  for (let i = 0; i < flatData.length; i += 3) {
    mirrored.push(2 * wristX - flatData[i]); 
    mirrored.push(flatData[i + 1]);          
    mirrored.push(flatData[i + 2]);          
  }
  return mirrored;
};

export const getMirroredDynamicData2D = (sequence: number[][]) => {
  return sequence.map(frame => {
    const mirroredFrame = [];
    const wristX = frame[0];
    for (let i = 0; i < frame.length; i += 2) {
      mirroredFrame.push(2 * wristX - frame[i]);
      mirroredFrame.push(frame[i + 1]);
    }
    return mirroredFrame;
  });
};

export const addNoise = (sequence: number[][], noiseLevel = 0.005) => {
  return sequence.map(frame => 
    frame.map(val => val + (Math.random() - 0.5) * noiseLevel)
  );
};

export const timeShift = (sequence: number[][], shiftFrames: number) => {
  if (shiftFrames > 0) {
    return [...sequence.slice(shiftFrames), ...Array(shiftFrames).fill(sequence[sequence.length - 1])];
  } else {
    const absShift = Math.abs(shiftFrames);
    return [...Array(absShift).fill(sequence[0]), ...sequence.slice(0, sequence.length - absShift)];
  }
};