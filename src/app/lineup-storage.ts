import JSZip from 'jszip';

export type TeamSide = 'ct' | 't';
export type GrenadeCategoryId = 'smoke' | 'flash' | 'molotov' | 'he';
export type MediaKind = 'image' | 'video';

export type StoredMedia = {
  id: string;
  name: string;
  type: MediaKind;
  mimeType: string;
  blob: Blob;
  url: string;
};

export type StoredPoint = {
  id: string;
  label: string;
  mapId: string;
  levelId: string;
  x: number;
  y: number;
  kind: 'custom';
  grenadeCategoryId: GrenadeCategoryId;
  teamSide: TeamSide;
  title: string;
  requirements: string[];
  media: StoredMedia[];
};

type PointRecord = Omit<StoredPoint, 'media'> & {
  media: Array<Omit<StoredMedia, 'blob' | 'url'>>;
};

type MediaRecord = {
  id: string;
  pointId: string;
  name: string;
  type: MediaKind;
  mimeType: string;
  blob: Blob;
};

type ExportMedia = Omit<StoredMedia, 'blob' | 'url'> & {
  fileName: string;
};

type ExportManifest = {
  version: 1;
  exportedAt: string;
  points: Array<Omit<PointRecord, 'media'> & { media: ExportMedia[] }>;
};

const DB_NAME = 'cs2nades-lineups';
const DB_VERSION = 1;
const POINTS_STORE = 'points';
const MEDIA_STORE = 'media';

export class LineupStorage {
  private dbPromise: Promise<IDBDatabase> | undefined;

  async loadPoints(): Promise<StoredPoint[]> {
    if (!this.hasIndexedDb()) {
      return [];
    }

    const db = await this.openDb();
    const pointRecords = await this.getAll<PointRecord>(db, POINTS_STORE);
    const mediaRecords = await this.getAll<MediaRecord>(db, MEDIA_STORE);

    return pointRecords.map((point) => ({
      ...point,
      media: mediaRecords
        .filter((media) => media.pointId === point.id)
        .map((media) => ({
          id: media.id,
          name: media.name,
          type: media.type,
          mimeType: media.mimeType,
          blob: media.blob,
          url: URL.createObjectURL(media.blob),
        })),
    }));
  }

  async savePoint(point: StoredPoint): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    const pointRecord: PointRecord = {
      ...point,
      media: point.media.map(({ id, name, type, mimeType }) => ({ id, name, type, mimeType })),
    };
    const mediaRecords: MediaRecord[] = point.media.map((media) => ({
      id: media.id,
      pointId: point.id,
      name: media.name,
      type: media.type,
      mimeType: media.mimeType,
      blob: media.blob,
    }));

    await this.transaction(db, [POINTS_STORE, MEDIA_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(POINTS_STORE).put(pointRecord);
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      mediaStore.index('pointId').openCursor(IDBKeyRange.only(point.id)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      for (const media of mediaRecords) {
        mediaStore.put(media);
      }
    });
  }

  async deletePoint(pointId: string): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [POINTS_STORE, MEDIA_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(POINTS_STORE).delete(pointId);
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      mediaStore.index('pointId').openCursor(IDBKeyRange.only(pointId)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }

  async replaceAll(points: StoredPoint[]): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [POINTS_STORE, MEDIA_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(POINTS_STORE).clear();
      transaction.objectStore(MEDIA_STORE).clear();
      const pointStore = transaction.objectStore(POINTS_STORE);
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      for (const point of points) {
        pointStore.put({
          ...point,
          media: point.media.map(({ id, name, type, mimeType }) => ({ id, name, type, mimeType })),
        } satisfies PointRecord);
        for (const media of point.media) {
          mediaStore.put({
            id: media.id,
            pointId: point.id,
            name: media.name,
            type: media.type,
            mimeType: media.mimeType,
            blob: media.blob,
          } satisfies MediaRecord);
        }
      }
    });
  }

  async exportZip(points: StoredPoint[]): Promise<Blob> {
    const zip = new JSZip();
    const manifest: ExportManifest = {
      version: 1,
      exportedAt: new Date().toISOString(),
      points: points.map((point) => ({
        ...point,
        media: point.media.map((media) => {
          const fileName = `media/${media.id}-${this.safeFileName(media.name)}`;
          zip.file(fileName, media.blob);
          return {
            id: media.id,
            name: media.name,
            type: media.type,
            mimeType: media.mimeType,
            fileName,
          };
        }),
      })),
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    return zip.generateAsync({ type: 'blob' });
  }

  async importZip(file: File): Promise<StoredPoint[]> {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('manifest.json is missing');
    }

    const manifest = JSON.parse(await manifestFile.async('string')) as ExportManifest;
    if (manifest.version !== 1 || !Array.isArray(manifest.points)) {
      throw new Error('Unsupported import file');
    }

    return Promise.all(manifest.points.map(async (point) => ({
      ...point,
      media: await Promise.all(point.media.map(async (media) => {
        const mediaFile = zip.file(media.fileName);
        if (!mediaFile) {
          throw new Error(`Media file is missing: ${media.fileName}`);
        }

        const importedBlob = await mediaFile.async('blob');
        const blob = new Blob([importedBlob], { type: media.mimeType });
        return {
          id: media.id,
          name: media.name,
          type: media.type,
          mimeType: media.mimeType,
          blob,
          url: URL.createObjectURL(blob),
        };
      })),
    })));
  }

  private hasIndexedDb(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private openDb(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(POINTS_STORE)) {
          db.createObjectStore(POINTS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
          mediaStore.createIndex('pointId', 'pointId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private transaction(
    db: IDBDatabase,
    storeNames: string[],
    mode: IDBTransactionMode,
    callback: (transaction: IDBTransaction) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      callback(transaction);
    });
  }

  private safeFileName(name: string): string {
    return name.replace(/[^\w.-]+/g, '_');
  }
}
