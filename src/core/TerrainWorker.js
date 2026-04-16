// Web Worker entry: runs terrain compute + river carving off the main thread.
// Communicates via typed-array transferables so there is no copy-back cost.
import { computeTerrainArrays, carveRiversArrays } from './TerrainCompute.js';

self.onmessage = (e) => {
  const { sgwt, sght, rivers, hd, K } = e.data;
  const report = (v) => self.postMessage({ type: 'progress', value: v });
  try {
    report(0.0);
    const { positions, colors } = computeTerrainArrays(sgwt, sght, hd ? hd.data : null, K, report);
    carveRiversArrays(positions, colors, sgwt, sght, rivers, K, report);
    self.postMessage(
      { type: 'done', positions, colors },
      [positions.buffer, colors.buffer]
    );
  } catch (err) {
    self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
  }
};
