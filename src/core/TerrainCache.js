// Minimal IndexedDB cache for pre-built terrain Float32Arrays.
// Structured-clone stores typed arrays efficiently (no base64 bloat).
const DB_NAME = 'poetry-landscape';
const STORE   = 'terrain';
const DB_VER  = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function cacheGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

export async function cachePut(key, value) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve();
    });
  } catch { /* ignore */ }
}

// Cache key includes grid size + version. Bump VERSION if you change terrain
// algorithms, river data, or DEM source.
// v2: DEM Z=5 → Z=6 (higher elevation fidelity, 4× DEM pixels)
// v3: 海岸沙滩段 (tColor 色板在 0-30m 加浅米色过渡)
// v4: R1 河流变宽渐变 + R2 河岸双段染色 (内蓝外绿)
const VERSION = 4;
export function cacheKeyFor(sgwt, sght) {
  return `terrain-${sgwt}x${sght}-v${VERSION}`;
}
