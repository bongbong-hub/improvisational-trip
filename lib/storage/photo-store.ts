// 사진 원본만 IndexedDB 에 둔다. 세션 JSON 에 Blob 을 넣으면 localStorage 한도에 먼저 걸린다 (SDD 6장).

const DB_NAME = "trip";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const putPhoto = (key: string, blob: Blob) =>
  tx("readwrite", (store) => store.put(blob, key));

export const getPhoto = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key));
