import JSZip from 'jszip';

export type TeamSide = 'ct' | 't';
export type GrenadeCategoryId = 'smoke' | 'flash' | 'molotov' | 'he';
export type MediaKind = 'image' | 'video';
export type MediaRole = 'start' | 'result' | 'detail';

export type StoredTrajectoryVertex = {
  id: string;
  x: number;
  y: number;
};

export type StoredTrajectory = {
  vertices: StoredTrajectoryVertex[];
};

export type StoredMedia = {
  id: string;
  name: string;
  type: MediaKind;
  mimeType: string;
  blob: Blob;
  url: string;
  role?: MediaRole;
  createdAt?: string;
  sourceLineupId?: string;
  sourceLineupTitle?: string;
};

export type StoredPoint = {
  id: string;
  resultSpotId?: string;
  label: string;
  mapId: string;
  levelId: string;
  x: number;
  y: number;
  kind: 'custom';
  grenadeCategoryId: GrenadeCategoryId;
  teamSide: TeamSide;
  title: string;
  description?: string;
  requirements: string[];
  media: StoredMedia[];
  heroMediaId?: string;
  trajectory?: StoredTrajectory;
  createdAt?: string;
  updatedAt?: string;
};

export type StoredResultSpot = {
  id: string;
  label: string;
  mapId: string;
  levelId: string;
  x: number;
  y: number;
  grenadeCategoryId: GrenadeCategoryId;
  teamSide: TeamSide;
  createdAt?: string;
  updatedAt?: string;
};

export type StoredResultSpotWithLineups = StoredResultSpot & {
  lineups: StoredPoint[];
};

export type StoredMap = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  levelId: string;
  levelName: string;
  levelDescription: string;
  imageName: string;
  imageMimeType: string;
  imageBlob: Blob;
  imageUrl: string;
};

type PointRecord = Omit<StoredPoint, 'media'> & {
  media: Array<Omit<StoredMedia, 'blob' | 'url'>>;
};

type MapRecord = Omit<StoredMap, 'imageUrl'>;

type MediaRecord = {
  id: string;
  pointId: string;
  name: string;
  type: MediaKind;
  mimeType: string;
  blob: Blob;
  role?: MediaRole;
  createdAt?: string;
};

type ExportMedia = Omit<StoredMedia, 'blob' | 'url'> & {
  fileName: string;
};

type ExportManifest = {
  version: 1;
  exportedAt: string;
  maps?: Array<Omit<StoredMap, 'imageBlob' | 'imageUrl'> & { imageFileName: string }>;
  points: Array<Omit<PointRecord, 'media'> & { media: ExportMedia[] }>;
};

type ContentLineupMedia = {
  id: string;
  name: string;
  role: MediaRole;
  type: MediaKind;
  mimeType: string;
  path: string;
};

type ContentLineup = {
  id: string;
  title: string;
  description: string;
  label: string;
  mapId: string;
  levelId: string;
  teamSide: TeamSide;
  grenadeCategoryId: GrenadeCategoryId;
  resultPoint: Pick<StoredPoint, 'x' | 'y'>;
  trajectory: StoredTrajectory;
  requirements: string[];
  media: ContentLineupMedia[];
};

const DB_NAME = 'cs2nades-lineups';
const DB_VERSION = 2;
const POINTS_STORE = 'points';
const MEDIA_STORE = 'media';
const MAPS_STORE = 'maps';

export type StorageMigrationStatus = {
  isDesktop: boolean;
  needsMigration: boolean;
  completed: boolean;
  defaultContentRoot?: string;
  contentRoot?: string;
  error?: string;
};

export interface LineupStoragePort {
  loadMaps(): Promise<StoredMap[]>;
  saveMap(map: StoredMap): Promise<void>;
  loadPoints(): Promise<StoredPoint[]>;
  savePoint(point: StoredPoint): Promise<void>;
  deletePoint(pointId: string): Promise<void>;
  replaceAll(points: StoredPoint[]): Promise<void>;
  replaceAllMaps(maps: StoredMap[]): Promise<void>;
  exportZip(points: StoredPoint[], maps?: StoredMap[]): Promise<Blob>;
  importZip(file: File): Promise<StoredPoint[]>;
  importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[] }>;
  loadResultSpotsWithLineups?(): Promise<StoredResultSpotWithLineups[]>;
  saveResultSpot?(spot: StoredResultSpot): Promise<void>;
  deleteResultSpot?(spotId: string): Promise<void>;
  saveLineupVariant?(lineup: StoredPoint): Promise<void>;
  deleteLineupVariant?(lineupId: string): Promise<void>;
  loadMediaAssets?(): Promise<StoredMedia[]>;
  addMediaAsset?(media: StoredMedia, mapId?: string): Promise<StoredMedia>;
  attachMediaToLineup?(lineupId: string, media: StoredMedia, role: MediaRole, sortOrder?: number): Promise<void>;
  getMigrationStatus?(): Promise<StorageMigrationStatus>;
  migrateLegacyData?(contentRoot?: string): Promise<void>;
}

export class WebLineupStorage implements LineupStoragePort {
  private dbPromise: Promise<IDBDatabase> | undefined;

  async loadMaps(): Promise<StoredMap[]> {
    if (!this.hasIndexedDb()) {
      return [];
    }

    const db = await this.openDb();
    const mapRecords = await this.getAll<MapRecord>(db, MAPS_STORE);
    return mapRecords.map((map) => ({
      ...map,
      imageUrl: URL.createObjectURL(map.imageBlob),
    }));
  }

  async saveMap(map: StoredMap): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [MAPS_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(MAPS_STORE).put(this.toMapRecord(map));
    });
  }

  async loadPoints(): Promise<StoredPoint[]> {
    if (!this.hasIndexedDb()) {
      return [];
    }

    const db = await this.openDb();
    const pointRecords = await this.getAll<PointRecord>(db, POINTS_STORE);
    const mediaRecords = await this.getAll<MediaRecord>(db, MEDIA_STORE);

    return pointRecords.map((point) => {
      const mediaById = new Map(mediaRecords
        .filter((media) => media.pointId === point.id)
        .map((media) => [media.id, media]));

      const resultSpotId = point.resultSpotId ?? point.id;
      return {
        ...point,
        resultSpotId,
        media: point.media
          .map((media) => mediaById.get(media.id))
          .filter((media): media is MediaRecord => Boolean(media))
          .map((media) => ({
            id: media.id,
            name: media.name,
            type: media.type,
            mimeType: media.mimeType,
            blob: media.blob,
            url: URL.createObjectURL(media.blob),
            role: media.role ?? 'detail',
            createdAt: media.createdAt,
            sourceLineupId: media.pointId,
            sourceLineupTitle: point.title,
          })),
        trajectory: point.trajectory ?? { vertices: [] },
        createdAt: point.createdAt,
        updatedAt: point.updatedAt,
      };
    });
  }

  async savePoint(point: StoredPoint): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    const pointRecord: PointRecord = {
      ...point,
      media: point.media.map(({ id, name, type, mimeType, role }) => ({ id, name, type, mimeType, role: role ?? 'detail' })),
      trajectory: point.trajectory ?? { vertices: [] },
      resultSpotId: point.resultSpotId ?? point.id,
      createdAt: point.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const mediaRecords: MediaRecord[] = point.media.map((media) => ({
      id: media.id,
      pointId: point.id,
      name: media.name,
      type: media.type,
      mimeType: media.mimeType,
      blob: media.blob,
      role: media.role ?? 'detail',
      createdAt: media.createdAt ?? new Date().toISOString(),
    }));

    await this.transaction(db, [POINTS_STORE, MEDIA_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(POINTS_STORE).put(pointRecord);
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      mediaStore.index('pointId').openCursor(IDBKeyRange.only(point.id)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
          return;
        }

        for (const media of mediaRecords) {
          mediaStore.put(media);
        }
      };
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
          media: point.media.map(({ id, name, type, mimeType, role }) => ({ id, name, type, mimeType, role: role ?? 'detail' })),
          trajectory: point.trajectory ?? { vertices: [] },
          resultSpotId: point.resultSpotId ?? point.id,
          createdAt: point.createdAt ?? new Date().toISOString(),
          updatedAt: point.updatedAt ?? new Date().toISOString(),
        } satisfies PointRecord);
        for (const media of point.media) {
          mediaStore.put({
            id: media.id,
            pointId: point.id,
            name: media.name,
            type: media.type,
            mimeType: media.mimeType,
            blob: media.blob,
            role: media.role ?? 'detail',
            createdAt: media.createdAt ?? new Date().toISOString(),
          } satisfies MediaRecord);
        }
      }
    });
  }

  async loadMediaAssets(): Promise<StoredMedia[]> {
    if (!this.hasIndexedDb()) {
      return [];
    }

    const db = await this.openDb();
    const pointRecords = await this.getAll<PointRecord>(db, POINTS_STORE);
    const titleByPointId = new Map(pointRecords.map((point) => [point.id, point.title]));
    const mediaRecords = await this.getAll<MediaRecord>(db, MEDIA_STORE);
    const uniqueMedia = new Map<string, MediaRecord>();
    for (const media of mediaRecords) {
      if (!uniqueMedia.has(media.id)) {
        uniqueMedia.set(media.id, media);
      }
    }

    return Array.from(uniqueMedia.values())
      .map((media) => ({
        id: media.id,
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob: media.blob,
        url: URL.createObjectURL(media.blob),
        role: 'detail' as const,
        createdAt: media.createdAt,
        sourceLineupId: media.pointId,
        sourceLineupTitle: titleByPointId.get(media.pointId),
      }))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  async addMediaAsset(media: StoredMedia): Promise<StoredMedia> {
    return { ...media, role: 'detail', createdAt: media.createdAt ?? new Date().toISOString() };
  }

  async attachMediaToLineup(): Promise<void> {
    return;
  }

  async replaceAllMaps(maps: StoredMap[]): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [MAPS_STORE], 'readwrite', (transaction) => {
      const mapStore = transaction.objectStore(MAPS_STORE);
      mapStore.clear();
      for (const map of maps) {
        mapStore.put(this.toMapRecord(map));
      }
    });
  }

  async loadResultSpotsWithLineups(): Promise<StoredResultSpotWithLineups[]> {
    return this.pointsToResultSpots(await this.loadPoints());
  }

  async saveResultSpot(spot: StoredResultSpot): Promise<void> {
    const points = await this.loadPoints();
    await Promise.all(points
      .filter((point) => (point.resultSpotId ?? point.id) === spot.id)
      .map((point) => this.savePoint({
        ...point,
        label: spot.label,
        mapId: spot.mapId,
        levelId: spot.levelId,
        x: spot.x,
        y: spot.y,
        grenadeCategoryId: spot.grenadeCategoryId,
        teamSide: spot.teamSide,
        updatedAt: new Date().toISOString(),
      })));
  }

  async deleteResultSpot(spotId: string): Promise<void> {
    const points = await this.loadPoints();
    await Promise.all(points
      .filter((point) => (point.resultSpotId ?? point.id) === spotId)
      .map((point) => this.deletePoint(point.id)));
  }

  saveLineupVariant(lineup: StoredPoint): Promise<void> {
    return this.savePoint(lineup);
  }

  deleteLineupVariant(lineupId: string): Promise<void> {
    return this.deletePoint(lineupId);
  }

  async exportZip(points: StoredPoint[], maps: StoredMap[] = []): Promise<Blob> {
    const zip = new JSZip();
    const contentLineups = new Map<string, ContentLineup[]>();
    const exportMaps = maps.map((map) => {
      const imageFileName = `Content/Maps/${this.safeFolderName(map.id)}/Meta/${this.safeFileName(map.imageName)}`;
      zip.file(imageFileName, map.imageBlob);
      return {
        id: map.id,
        name: map.name,
        location: map.location,
        tags: map.tags,
        levelId: map.levelId,
        levelName: map.levelName,
        levelDescription: map.levelDescription,
        imageName: map.imageName,
        imageMimeType: map.imageMimeType,
        imageFileName,
      };
    });
    const manifest: ExportManifest = {
      version: 1,
      exportedAt: new Date().toISOString(),
      maps: exportMaps,
      points: points.map((point) => ({
        ...point,
        media: point.media.map((media) => {
          const fileName = this.contentMediaPath(point, media);
          zip.file(fileName, media.blob);
          return {
            id: media.id,
            name: media.name,
            type: media.type,
            mimeType: media.mimeType,
            role: media.role ?? 'detail',
            fileName,
          };
        }),
      })),
    };

    for (const point of manifest.points) {
      const mapLineups = contentLineups.get(point.mapId) ?? [];
      mapLineups.push({
        id: point.id,
        title: point.title,
        description: point.description ?? '',
        label: point.label,
        mapId: point.mapId,
        levelId: point.levelId,
        teamSide: point.teamSide,
        grenadeCategoryId: point.grenadeCategoryId,
        resultPoint: { x: point.x, y: point.y },
        trajectory: point.trajectory ?? { vertices: [] },
        requirements: point.requirements,
        media: point.media.map((media) => ({
          id: media.id,
          name: media.name,
          role: media.role ?? 'detail',
          type: media.type,
          mimeType: media.mimeType,
          path: media.fileName,
        })),
      });
      contentLineups.set(point.mapId, mapLineups);
    }

    zip.file('Content/README.txt', this.contentReadme());
    for (const map of exportMaps) {
      const mapDir = `Content/Maps/${this.safeFolderName(map.id)}`;
      zip.file(`${mapDir}/Meta/map.json`, JSON.stringify({
        id: map.id,
        name: map.name,
        location: map.location,
        tags: map.tags,
        levels: [
          {
            id: map.levelId,
            name: map.levelName,
            description: map.levelDescription,
            imagePath: map.imageFileName,
          },
        ],
      }, null, 2));
      zip.folder(`${mapDir}/User/Inbox`);
      zip.folder(`${mapDir}/User/Media`);
    }
    for (const [mapId, lineups] of contentLineups) {
      const mapDir = `Content/Maps/${this.safeFolderName(mapId)}`;
      if (!exportMaps.some((map) => map.id === mapId)) {
        zip.file(`${mapDir}/Meta/map.json`, JSON.stringify({ id: mapId }, null, 2));
      }
      zip.file(`${mapDir}/Meta/lineups.json`, JSON.stringify({ version: 1, mapId, lineups }, null, 2));
      zip.folder(`${mapDir}/User/Inbox`);
    }

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
      trajectory: point.trajectory ?? { vertices: [] },
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
          role: media.role ?? 'detail',
        };
      })),
    })));
  }

  async importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[] }> {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('manifest.json is missing');
    }

    const manifest = JSON.parse(await manifestFile.async('string')) as ExportManifest;
    if (manifest.version !== 1 || !Array.isArray(manifest.points)) {
      throw new Error('Unsupported import file');
    }

    const maps = await Promise.all((manifest.maps ?? []).map(async (map) => {
      const imageFile = zip.file(map.imageFileName);
      if (!imageFile) {
        throw new Error(`Map image is missing: ${map.imageFileName}`);
      }

      const importedBlob = await imageFile.async('blob');
      const imageBlob = new Blob([importedBlob], { type: map.imageMimeType });
      return {
        id: map.id,
        name: map.name,
        location: map.location,
        tags: map.tags,
        levelId: map.levelId,
        levelName: map.levelName,
        levelDescription: map.levelDescription,
        imageName: map.imageName,
        imageMimeType: map.imageMimeType,
        imageBlob,
        imageUrl: URL.createObjectURL(imageBlob),
      };
    }));

    return {
      maps,
      points: await this.importZip(file),
    };
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
        if (!db.objectStoreNames.contains(MAPS_STORE)) {
          db.createObjectStore(MAPS_STORE, { keyPath: 'id' });
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

  private pointsToResultSpots(points: StoredPoint[]): StoredResultSpotWithLineups[] {
    const groups = new Map<string, StoredPoint[]>();
    for (const point of points) {
      const resultSpotId = point.resultSpotId ?? point.id;
      groups.set(resultSpotId, [...(groups.get(resultSpotId) ?? []), { ...point, resultSpotId }]);
    }

    return Array.from(groups.entries()).map(([id, lineups]) => {
      const firstLineup = lineups[0];
      return {
        id,
        label: firstLineup.label,
        mapId: firstLineup.mapId,
        levelId: firstLineup.levelId,
        x: firstLineup.x,
        y: firstLineup.y,
        grenadeCategoryId: firstLineup.grenadeCategoryId,
        teamSide: firstLineup.teamSide,
        createdAt: firstLineup.createdAt,
        updatedAt: firstLineup.updatedAt,
        lineups,
      };
    });
  }

  private contentMediaPath(point: StoredPoint, media: StoredMedia): string {
    const role = media.role ?? 'detail';
    return [
      'Content',
      'Maps',
      this.safeFolderName(point.mapId),
      'User',
      'Media',
      '_Pool',
      `${role}-${this.safeFileName(media.id)}-${this.safeFileName(media.name)}`,
    ].join('/');
  }

  private safeFolderName(name: string): string {
    const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim();
    return safeName || '_Unknown';
  }

  private contentReadme(): string {
    return [
      'CS2 Nades content workspace',
      '',
      'Content/Maps/<map>/Meta contains app-readable JSON metadata.',
      'Content/Maps/<map>/User contains user-owned screenshots, videos, inbox files, and future generated content.',
      'System or app binary folders are reserved for application internals and should not be edited manually.',
      '',
      'The root manifest.json is kept for backwards-compatible imports.',
      '',
    ].join('\n');
  }

  private toMapRecord(map: StoredMap): MapRecord {
    const { imageUrl, ...record } = map;
    void imageUrl;
    return record;
  }
}

type TauriCore = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
};

type TauriDatabase = {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
};

type TauriDatabaseCtor = {
  load(path: string): Promise<TauriDatabase>;
};

type ContentWorkspaceInfo = {
  rootDir: string;
  contentDir: string;
  mapsDir: string;
  systemDir: string;
};

type LineupRow = Omit<StoredPoint, 'media' | 'trajectory' | 'requirements'> & {
  requirementsJson: string;
  trajectoryJson: string;
  resultSpotId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MediaRow = Omit<StoredMedia, 'blob' | 'url'> & {
  path: string;
  sortOrder: number;
  createdAt?: string;
  sourceLineupId?: string;
  sourceLineupTitle?: string;
};

type MapRow = Omit<StoredMap, 'imageBlob' | 'imageUrl'> & {
  imagePath: string;
};

class DesktopLineupStorage implements LineupStoragePort {
  private readonly zipStorage = new WebLineupStorage();
  private dbPromise: Promise<TauriDatabase> | undefined;
  private corePromise: Promise<TauriCore> | undefined;
  private workspacePromise: Promise<ContentWorkspaceInfo> | undefined;
  private selectedContentRoot: string | undefined;

  constructor(private readonly legacyStorage: WebLineupStorage) {}

  async loadMaps(): Promise<StoredMap[]> {
    const db = await this.db();
    const workspace = await this.workspace();
    const rows = await db.select<MapRow[]>('SELECT * FROM maps ORDER BY name');
    return Promise.all(rows.map(async (row) => {
      const blob = await this.readBlob(workspace.rootDir, row.imagePath, row.imageMimeType);
      return {
        id: row.id,
        name: row.name,
        location: row.location,
        tags: this.parseJson<string[]>(row.tags as unknown as string, []),
        levelId: row.levelId,
        levelName: row.levelName,
        levelDescription: row.levelDescription,
        imageName: row.imageName,
        imageMimeType: row.imageMimeType,
        imageBlob: blob,
        imageUrl: URL.createObjectURL(blob),
      };
    }));
  }

  async saveMap(map: StoredMap): Promise<void> {
    const db = await this.db();
    const workspace = await this.workspace([map.name]);
    const imagePath = `Content/Maps/${this.safeFolderName(map.id)}/Meta/${this.safeFileName(map.imageName)}`;
    await this.writeBlob(workspace.rootDir, imagePath, map.imageBlob);
    await db.execute(
      `INSERT INTO maps (
        id, name, location, tags, levelId, levelName, levelDescription, imageName, imageMimeType, imagePath
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        location=excluded.location,
        tags=excluded.tags,
        levelId=excluded.levelId,
        levelName=excluded.levelName,
        levelDescription=excluded.levelDescription,
        imageName=excluded.imageName,
        imageMimeType=excluded.imageMimeType,
        imagePath=excluded.imagePath`,
      [
        map.id,
        map.name,
        map.location,
        JSON.stringify(map.tags),
        map.levelId,
        map.levelName,
        map.levelDescription,
        map.imageName,
        map.imageMimeType,
        imagePath,
      ],
    );
  }

  async loadPoints(): Promise<StoredPoint[]> {
    const db = await this.db();
    const workspace = await this.workspace();
    const lineups = await db.select<LineupRow[]>('SELECT * FROM lineups ORDER BY id');
    const mediaRows = await db.select<(MediaRow & { lineupId: string })[]>(
      `SELECT media_assets.id, media_assets.name, media_assets.type, media_assets.mimeType, media_assets.path,
        lineup_media.role, lineup_media.sortOrder, lineup_media.lineupId
      FROM lineup_media
      JOIN media_assets ON media_assets.id = lineup_media.mediaId
      ORDER BY lineup_media.lineupId, lineup_media.sortOrder`,
    );

    const mediaByLineup = new Map<string, Array<MediaRow & { lineupId: string }>>();
    for (const media of mediaRows) {
      mediaByLineup.set(media.lineupId, [...(mediaByLineup.get(media.lineupId) ?? []), media]);
    }

    return Promise.all(lineups.map(async (lineup) => ({
      id: lineup.id,
      resultSpotId: lineup.resultSpotId ?? lineup.id,
      label: lineup.label,
      mapId: lineup.mapId,
      levelId: lineup.levelId,
      x: lineup.x,
      y: lineup.y,
      kind: 'custom',
      grenadeCategoryId: lineup.grenadeCategoryId,
      teamSide: lineup.teamSide,
      title: lineup.title,
      description: lineup.description ?? '',
      requirements: this.parseJson<string[]>(lineup.requirementsJson, []),
      heroMediaId: lineup.heroMediaId,
      trajectory: this.parseJson<StoredTrajectory>(lineup.trajectoryJson, { vertices: [] }),
      media: await Promise.all((mediaByLineup.get(lineup.id) ?? []).map(async (media) => {
        const blob = await this.readBlob(workspace.rootDir, media.path, media.mimeType);
        return {
          id: media.id,
          name: media.name,
          type: media.type,
          mimeType: media.mimeType,
          blob,
          url: URL.createObjectURL(blob),
          role: media.role ?? 'detail',
          createdAt: media.createdAt,
          sourceLineupId: media.lineupId,
          sourceLineupTitle: lineup.title,
        };
      })),
      createdAt: lineup.createdAt,
      updatedAt: lineup.updatedAt,
    } satisfies StoredPoint)));
  }

  async savePoint(point: StoredPoint): Promise<void> {
    const db = await this.db();
    const workspace = await this.workspace([point.mapId]);
    await this.upsertLineup(db, point);
    await db.execute('DELETE FROM lineup_media WHERE lineupId = $1', [point.id]);
    await Promise.all(point.media.map(async (media, index) => {
      const path = this.contentMediaPath(point, media);
      await this.writeBlob(workspace.rootDir, path, media.blob);
      await db.execute(
        `INSERT INTO media_assets (id, name, type, mimeType, path, checksum, createdAt)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          type=excluded.type,
          mimeType=excluded.mimeType,
          path=excluded.path`,
        [media.id, media.name, media.type, media.mimeType, path, '', media.createdAt ?? new Date().toISOString()],
      );
      await db.execute(
        `INSERT INTO lineup_media (lineupId, mediaId, role, sortOrder)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT(lineupId, mediaId) DO UPDATE SET role=excluded.role, sortOrder=excluded.sortOrder`,
        [point.id, media.id, media.role ?? 'detail', index],
      );
    }));
  }

  async deletePoint(pointId: string): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM lineup_media WHERE lineupId = $1', [pointId]);
    await db.execute('DELETE FROM lineups WHERE id = $1', [pointId]);
  }

  async replaceAll(points: StoredPoint[]): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM lineup_media');
    await db.execute('DELETE FROM lineups');
    for (const point of points) {
      await this.savePoint(point);
    }
  }

  async replaceAllMaps(maps: StoredMap[]): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM maps');
    for (const map of maps) {
      await this.saveMap(map);
    }
  }

  async loadResultSpotsWithLineups(): Promise<StoredResultSpotWithLineups[]> {
    return this.pointsToResultSpots(await this.loadPoints());
  }

  async saveResultSpot(spot: StoredResultSpot): Promise<void> {
    const points = await this.loadPoints();
    await Promise.all(points
      .filter((point) => (point.resultSpotId ?? point.id) === spot.id)
      .map((point) => this.savePoint({
        ...point,
        label: spot.label,
        mapId: spot.mapId,
        levelId: spot.levelId,
        x: spot.x,
        y: spot.y,
        grenadeCategoryId: spot.grenadeCategoryId,
        teamSide: spot.teamSide,
        updatedAt: new Date().toISOString(),
      })));
  }

  async deleteResultSpot(spotId: string): Promise<void> {
    const points = await this.loadPoints();
    await Promise.all(points
      .filter((point) => (point.resultSpotId ?? point.id) === spotId)
      .map((point) => this.deletePoint(point.id)));
  }

  saveLineupVariant(lineup: StoredPoint): Promise<void> {
    return this.savePoint(lineup);
  }

  deleteLineupVariant(lineupId: string): Promise<void> {
    return this.deletePoint(lineupId);
  }

  async loadMediaAssets(): Promise<StoredMedia[]> {
    const db = await this.db();
    const workspace = await this.workspace();
    const rows = await db.select<Array<MediaRow & { sourceLineupTitle?: string }>>(
      `SELECT media_assets.id, media_assets.name, media_assets.type, media_assets.mimeType,
        media_assets.path, media_assets.createdAt, lineup_media.lineupId AS sourceLineupId,
        lineups.title AS sourceLineupTitle, 'detail' AS role, 0 AS sortOrder
      FROM media_assets
      LEFT JOIN lineup_media ON lineup_media.mediaId = media_assets.id
      LEFT JOIN lineups ON lineups.id = lineup_media.lineupId
      GROUP BY media_assets.id
      ORDER BY media_assets.createdAt DESC`,
    );

    return Promise.all(rows.map(async (media) => {
      const blob = await this.readBlob(workspace.rootDir, media.path, media.mimeType);
      return {
        id: media.id,
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob,
        url: URL.createObjectURL(blob),
        role: 'detail',
        createdAt: media.createdAt,
        sourceLineupId: media.sourceLineupId,
        sourceLineupTitle: media.sourceLineupTitle,
      } satisfies StoredMedia;
    }));
  }

  async addMediaAsset(media: StoredMedia, mapId = 'shared'): Promise<StoredMedia> {
    const db = await this.db();
    const workspace = await this.workspace([mapId]);
    const mediaAsset = { ...media, role: 'detail' as const, createdAt: media.createdAt ?? new Date().toISOString() };
    const path = this.contentMediaPath({ mapId } as StoredPoint, mediaAsset);
    await this.writeBlob(workspace.rootDir, path, mediaAsset.blob);
    await db.execute(
      `INSERT INTO media_assets (id, name, type, mimeType, path, checksum, createdAt)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        mimeType=excluded.mimeType,
        path=excluded.path`,
      [mediaAsset.id, mediaAsset.name, mediaAsset.type, mediaAsset.mimeType, path, '', mediaAsset.createdAt],
    );
    return mediaAsset;
  }

  async attachMediaToLineup(lineupId: string, media: StoredMedia, role: MediaRole, sortOrder = 0): Promise<void> {
    const db = await this.db();
    await db.execute(
      `INSERT INTO lineup_media (lineupId, mediaId, role, sortOrder)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT(lineupId, mediaId) DO UPDATE SET role=excluded.role, sortOrder=excluded.sortOrder`,
      [lineupId, media.id, role, sortOrder],
    );
  }

  exportZip(points: StoredPoint[], maps: StoredMap[] = []): Promise<Blob> {
    return this.zipStorage.exportZip(points, maps);
  }

  importZip(file: File): Promise<StoredPoint[]> {
    return this.zipStorage.importZip(file);
  }

  importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[] }> {
    return this.zipStorage.importZipData(file);
  }

  async getMigrationStatus(): Promise<StorageMigrationStatus> {
    try {
      const db = await this.db();
      const metaRows = await db.select<Array<{ key: string; value: string }>>(
        'SELECT key, value FROM app_meta WHERE key IN ($1, $2)',
        ['legacyMigrationCompleted', 'contentRoot'],
      );
      const meta = new Map(metaRows.map((row) => [row.key, row.value]));
      const completed = meta.get('legacyMigrationCompleted') === 'true';
      const storedContentRoot = meta.get('contentRoot')?.trim();
      if (storedContentRoot) {
        this.selectedContentRoot = storedContentRoot;
        this.workspacePromise = undefined;
      }
      const workspace = await this.workspace([], storedContentRoot || undefined);
      const [legacyPoints, legacyMaps] = await Promise.all([
        this.legacyStorage.loadPoints(),
        this.legacyStorage.loadMaps(),
      ]);
      return {
        isDesktop: true,
        needsMigration: !completed && (legacyPoints.length > 0 || legacyMaps.length > 0),
        completed,
        defaultContentRoot: workspace.rootDir,
        contentRoot: workspace.rootDir,
      };
    } catch (error) {
      return {
        isDesktop: true,
        needsMigration: false,
        completed: false,
        error: error instanceof Error ? error.message : 'Desktop storage is unavailable',
      };
    }
  }

  async migrateLegacyData(contentRoot?: string): Promise<void> {
    let stage = 'preparing content workspace';
    try {
      this.selectedContentRoot = contentRoot?.trim() || undefined;
      this.workspacePromise = undefined;
      const workspace = await this.workspace([], this.selectedContentRoot);
      stage = 'reading legacy IndexedDB data';
      const [points, maps] = await Promise.all([
        this.legacyStorage.loadPoints(),
        this.legacyStorage.loadMaps(),
      ]);
      stage = 'writing maps to desktop storage';
      await this.replaceAllMaps(maps);
      stage = 'writing lineups and media to desktop storage';
      await this.replaceAll(points);
      stage = 'writing migration marker';
      const db = await this.db();
      await db.execute(
        `INSERT INTO app_meta (key, value) VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        ['legacyMigrationCompleted', 'true'],
      );
      await db.execute(
        `INSERT INTO app_meta (key, value) VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        ['contentRoot', workspace.rootDir],
      );
      this.selectedContentRoot = workspace.rootDir;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Desktop migration failed while ${stage}: ${message}`);
    }
  }

  private async db(): Promise<TauriDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.loadDatabase();
    }
    return this.dbPromise;
  }

  private async loadDatabase(): Promise<TauriDatabase> {
    await this.workspace();
    const Database = await this.loadSql();
    const db = await Database.load('sqlite:cs2nades-content.sqlite');
    await this.ensureSchema(db);
    return db;
  }

  private async ensureSchema(db: TauriDatabase): Promise<void> {
    await db.execute(`CREATE TABLE IF NOT EXISTS result_spots (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      mapId TEXT NOT NULL,
      levelId TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      grenadeCategoryId TEXT NOT NULL,
      teamSide TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS lineups (
      id TEXT PRIMARY KEY,
      resultSpotId TEXT,
      label TEXT NOT NULL,
      mapId TEXT NOT NULL,
      levelId TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      kind TEXT NOT NULL,
      grenadeCategoryId TEXT NOT NULL,
      teamSide TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      requirementsJson TEXT NOT NULL,
      trajectoryJson TEXT NOT NULL,
      heroMediaId TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )`);
    await this.addColumnIfMissing(db, 'lineups', 'resultSpotId TEXT');
    await this.addColumnIfMissing(db, 'lineups', 'createdAt TEXT');
    await this.addColumnIfMissing(db, 'lineups', 'updatedAt TEXT');
    await db.execute(`CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      path TEXT NOT NULL,
      checksum TEXT,
      createdAt TEXT NOT NULL
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS lineup_media (
      lineupId TEXT NOT NULL,
      mediaId TEXT NOT NULL,
      role TEXT NOT NULL,
      sortOrder INTEGER NOT NULL,
      PRIMARY KEY (lineupId, mediaId)
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      tags TEXT NOT NULL,
      levelId TEXT NOT NULL,
      levelName TEXT NOT NULL,
      levelDescription TEXT NOT NULL,
      imageName TEXT NOT NULL,
      imageMimeType TEXT NOT NULL,
      imagePath TEXT NOT NULL
    )`);
    await db.execute('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await db.execute(
      `INSERT INTO app_meta (key, value) VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      ['schemaVersion', '2'],
    );
  }

  private async addColumnIfMissing(db: TauriDatabase, table: string, columnDefinition: string): Promise<void> {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}`);
    } catch {
      // SQLite throws when the column already exists; schema upgrades are idempotent.
    }
  }

  private async upsertLineup(db: TauriDatabase, point: StoredPoint): Promise<void> {
    const now = new Date().toISOString();
    const resultSpotId = point.resultSpotId ?? point.id;
    await db.execute(
      `INSERT INTO result_spots (
        id, label, mapId, levelId, x, y, grenadeCategoryId, teamSide, createdAt, updatedAt
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(id) DO UPDATE SET
        label=excluded.label,
        mapId=excluded.mapId,
        levelId=excluded.levelId,
        x=excluded.x,
        y=excluded.y,
        grenadeCategoryId=excluded.grenadeCategoryId,
        teamSide=excluded.teamSide,
        updatedAt=excluded.updatedAt`,
      [
        resultSpotId,
        point.label,
        point.mapId,
        point.levelId,
        point.x,
        point.y,
        point.grenadeCategoryId,
        point.teamSide,
        point.createdAt ?? now,
        now,
      ],
    );
    await db.execute(
      `INSERT INTO lineups (
        id, resultSpotId, label, mapId, levelId, x, y, kind, grenadeCategoryId, teamSide, title, description,
        requirementsJson, trajectoryJson, heroMediaId, createdAt, updatedAt
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT(id) DO UPDATE SET
        resultSpotId=excluded.resultSpotId,
        label=excluded.label,
        mapId=excluded.mapId,
        levelId=excluded.levelId,
        x=excluded.x,
        y=excluded.y,
        kind=excluded.kind,
        grenadeCategoryId=excluded.grenadeCategoryId,
        teamSide=excluded.teamSide,
        title=excluded.title,
        description=excluded.description,
        requirementsJson=excluded.requirementsJson,
        trajectoryJson=excluded.trajectoryJson,
        heroMediaId=excluded.heroMediaId,
        updatedAt=excluded.updatedAt`,
      [
        point.id,
        resultSpotId,
        point.label,
        point.mapId,
        point.levelId,
        point.x,
        point.y,
        point.kind,
        point.grenadeCategoryId,
        point.teamSide,
        point.title,
        point.description ?? '',
        JSON.stringify(point.requirements),
        JSON.stringify(point.trajectory ?? { vertices: [] }),
        point.heroMediaId ?? null,
        point.createdAt ?? now,
        now,
      ],
    );
  }

  private async workspace(mapNames: string[] = [], contentRoot?: string): Promise<ContentWorkspaceInfo> {
    const nextContentRoot = contentRoot?.trim() || this.selectedContentRoot;
    if (contentRoot !== undefined) {
      this.selectedContentRoot = nextContentRoot;
    }

    if (!this.workspacePromise || contentRoot !== undefined) {
      const core = await this.core();
      this.workspacePromise = core.invoke<ContentWorkspaceInfo>('ensure_content_workspace', {
        mapNames,
        contentRoot: nextContentRoot,
      });
    }
    return this.workspacePromise;
  }

  private async writeBlob(contentRoot: string, relativePath: string, blob: Blob): Promise<void> {
    const core = await this.core();
    await core.invoke('write_content_file', {
      contentRoot,
      relativePath,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    });
  }

  private async readBlob(contentRoot: string, relativePath: string, mimeType: string): Promise<Blob> {
    const core = await this.core();
    const bytes = await core.invoke<number[]>('read_content_file', { contentRoot, relativePath });
    return new Blob([new Uint8Array(bytes)], { type: mimeType });
  }

  private async core(): Promise<TauriCore> {
    if (!this.corePromise) {
      this.corePromise = this.loadCore();
    }
    return this.corePromise;
  }

  private async loadCore(): Promise<TauriCore> {
    if (!('__TAURI_INTERNALS__' in globalThis)) {
      throw new Error('Tauri runtime is not available');
    }
    return import('@tauri-apps/api/core');
  }

  private async loadSql(): Promise<TauriDatabaseCtor> {
    const module = await import('@tauri-apps/plugin-sql');
    return module.default;
  }

  private parseJson<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private safeFileName(name: string): string {
    return name.replace(/[^\w.-]+/g, '_');
  }

  private safeFolderName(name: string): string {
    const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim();
    return safeName || '_Unknown';
  }

  private pointsToResultSpots(points: StoredPoint[]): StoredResultSpotWithLineups[] {
    const groups = new Map<string, StoredPoint[]>();
    for (const point of points) {
      const resultSpotId = point.resultSpotId ?? point.id;
      groups.set(resultSpotId, [...(groups.get(resultSpotId) ?? []), { ...point, resultSpotId }]);
    }

    return Array.from(groups.entries()).map(([id, lineups]) => {
      const firstLineup = lineups[0];
      return {
        id,
        label: firstLineup.label,
        mapId: firstLineup.mapId,
        levelId: firstLineup.levelId,
        x: firstLineup.x,
        y: firstLineup.y,
        grenadeCategoryId: firstLineup.grenadeCategoryId,
        teamSide: firstLineup.teamSide,
        createdAt: firstLineup.createdAt,
        updatedAt: firstLineup.updatedAt,
        lineups,
      };
    });
  }

  private contentMediaPath(point: StoredPoint, media: StoredMedia): string {
    const role = media.role ?? 'detail';
    return [
      'Content',
      'Maps',
      this.safeFolderName(point.mapId),
      'User',
      'Media',
      '_Pool',
      `${role}-${this.safeFileName(media.id)}-${this.safeFileName(media.name)}`,
    ].join('/');
  }
}

export class LineupStorage implements LineupStoragePort {
  private readonly webStorage = new WebLineupStorage();
  private desktopStorage: DesktopLineupStorage | undefined;
  private useDesktop = false;
  private initialized = false;

  async loadMaps(): Promise<StoredMap[]> {
    return this.activeStorage().then((storage) => storage.loadMaps());
  }

  async saveMap(map: StoredMap): Promise<void> {
    return this.activeStorage().then((storage) => storage.saveMap(map));
  }

  async loadPoints(): Promise<StoredPoint[]> {
    return this.activeStorage().then((storage) => storage.loadPoints());
  }

  async savePoint(point: StoredPoint): Promise<void> {
    return this.activeStorage().then((storage) => storage.savePoint(point));
  }

  async deletePoint(pointId: string): Promise<void> {
    return this.activeStorage().then((storage) => storage.deletePoint(pointId));
  }

  async replaceAll(points: StoredPoint[]): Promise<void> {
    return this.activeStorage().then((storage) => storage.replaceAll(points));
  }

  async replaceAllMaps(maps: StoredMap[]): Promise<void> {
    return this.activeStorage().then((storage) => storage.replaceAllMaps(maps));
  }

  async exportZip(points: StoredPoint[], maps: StoredMap[] = []): Promise<Blob> {
    return this.activeStorage().then((storage) => storage.exportZip(points, maps));
  }

  async importZip(file: File): Promise<StoredPoint[]> {
    return this.activeStorage().then((storage) => storage.importZip(file));
  }

  async importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[] }> {
    return this.activeStorage().then((storage) => storage.importZipData(file));
  }

  async loadResultSpotsWithLineups(): Promise<StoredResultSpotWithLineups[]> {
    const storage = await this.activeStorage();
    return storage.loadResultSpotsWithLineups?.() ?? [];
  }

  async saveResultSpot(spot: StoredResultSpot): Promise<void> {
    const storage = await this.activeStorage();
    await storage.saveResultSpot?.(spot);
  }

  async deleteResultSpot(spotId: string): Promise<void> {
    const storage = await this.activeStorage();
    await storage.deleteResultSpot?.(spotId);
  }

  async saveLineupVariant(lineup: StoredPoint): Promise<void> {
    const storage = await this.activeStorage();
    await (storage.saveLineupVariant?.(lineup) ?? storage.savePoint(lineup));
  }

  async deleteLineupVariant(lineupId: string): Promise<void> {
    const storage = await this.activeStorage();
    await (storage.deleteLineupVariant?.(lineupId) ?? storage.deletePoint(lineupId));
  }

  async loadMediaAssets(): Promise<StoredMedia[]> {
    const storage = await this.activeStorage();
    return storage.loadMediaAssets?.() ?? [];
  }

  async addMediaAsset(media: StoredMedia, mapId?: string): Promise<StoredMedia> {
    const storage = await this.activeStorage();
    return storage.addMediaAsset?.(media, mapId) ?? media;
  }

  async attachMediaToLineup(lineupId: string, media: StoredMedia, role: MediaRole, sortOrder = 0): Promise<void> {
    const storage = await this.activeStorage();
    await storage.attachMediaToLineup?.(lineupId, media, role, sortOrder);
  }

  async getMigrationStatus(): Promise<StorageMigrationStatus> {
    const desktop = await this.desktop();
    if (!desktop) {
      return { isDesktop: false, needsMigration: false, completed: true };
    }

    const status = await desktop.getMigrationStatus?.();
    if (status?.completed && !status.error) {
      this.useDesktop = true;
    }
    return status ?? { isDesktop: true, needsMigration: false, completed: false };
  }

  async migrateLegacyData(contentRoot?: string): Promise<void> {
    const desktop = await this.desktop();
    if (!desktop) {
      return;
    }

    await desktop.migrateLegacyData?.(contentRoot);
    this.useDesktop = true;
  }

  private async activeStorage(): Promise<LineupStoragePort> {
    const desktop = await this.desktop();
    if (!desktop) {
      return this.webStorage;
    }

    if (!this.initialized) {
      const status = await desktop.getMigrationStatus?.();
      this.useDesktop = !status?.error && (Boolean(status?.completed) || !status?.needsMigration);
      this.initialized = true;
    }

    return this.useDesktop ? desktop : this.webStorage;
  }

  private async desktop(): Promise<DesktopLineupStorage | undefined> {
    if (!('__TAURI_INTERNALS__' in globalThis)) {
      return undefined;
    }

    this.desktopStorage ??= new DesktopLineupStorage(this.webStorage);
    return this.desktopStorage;
  }
}
