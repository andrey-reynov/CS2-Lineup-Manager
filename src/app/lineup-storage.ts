import JSZip from 'jszip';

export type TeamSide = 'ct' | 't';
export type GrenadeCategoryId = 'smoke' | 'flash' | 'molotov' | 'he';
export type MediaKind = 'image' | 'video';
export type MediaRole = 'start' | 'aim' | 'result' | 'detail';

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
  thumbnailBlob?: Blob;
  thumbnailUrl?: string;
  thumbnailMimeType?: string;
  previewBlob?: Blob;
  previewUrl?: string;
  previewMimeType?: string;
  assetOnly?: boolean;
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

export type StoredLineupSummary = Omit<StoredPoint, 'requirements' | 'media' | 'trajectory'> & {
  requirements?: string[];
  media?: Array<Omit<StoredMedia, 'blob' | 'url'> & { url?: string; blob?: Blob }>;
  trajectory?: StoredTrajectory;
  mediaCount?: number;
  mediaRoles?: MediaRole[];
  hasTrajectory?: boolean;
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

export type StoredPlaylist = {
  id: string;
  title: string;
  description: string;
  thumbnailName: string;
  thumbnailMimeType: string;
  thumbnailBlob: Blob;
  thumbnailUrl: string;
  createdAt?: string;
  updatedAt?: string;
  lineupIds?: string[];
};

type PointRecord = Omit<StoredPoint, 'media'> & {
  media: Array<Omit<StoredMedia, 'blob' | 'url'>>;
};

type MapRecord = Omit<StoredMap, 'imageUrl'>;

type PlaylistRecord = Omit<StoredPlaylist, 'thumbnailUrl' | 'lineupIds'>;

type PlaylistLineupRecord = {
  id: string;
  playlistId: string;
  lineupId: string;
};

type MediaRecord = {
  id: string;
  mediaId?: string;
  pointId: string;
  name: string;
  type: MediaKind;
  mimeType: string;
  blob: Blob;
  thumbnailBlob?: Blob;
  thumbnailMimeType?: string;
  previewBlob?: Blob;
  previewMimeType?: string;
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
  playlists?: Array<Omit<PlaylistRecord, 'thumbnailBlob'> & { thumbnailFileName: string; lineupIds: string[] }>;
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
const DB_VERSION = 4;
const POINTS_STORE = 'points';
const MEDIA_STORE = 'media';
const MAPS_STORE = 'maps';
const PLAYLISTS_STORE = 'playlists';
const PLAYLIST_LINEUPS_STORE = 'playlistLineups';

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
  exportZip(
    points: StoredPoint[],
    maps?: StoredMap[],
    playlists?: StoredPlaylist[],
    playlistMemberships?: Record<string, string[]>,
  ): Promise<Blob>;
  importZip(file: File): Promise<StoredPoint[]>;
  importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[]; playlists?: StoredPlaylist[] }>;
  loadPlaylists?(): Promise<StoredPlaylist[]>;
  savePlaylist?(playlist: StoredPlaylist): Promise<void>;
  deletePlaylist?(playlistId: string, deleteContent?: boolean): Promise<void>;
  loadPlaylistLineupIds?(playlistId: string): Promise<string[]>;
  loadLineupPlaylistIds?(lineupId: string): Promise<string[]>;
  loadPlaylistMemberships?(): Promise<Record<string, string[]>>;
  setPlaylistLineups?(playlistId: string, lineupIds: string[]): Promise<void>;
  setLineupPlaylists?(lineupId: string, playlistIds: string[]): Promise<void>;
  loadLineupSummaries?(mapId?: string, levelId?: string): Promise<StoredLineupSummary[]>;
  loadResultSpotLineups?(resultSpotId: string, mapId: string, levelId: string): Promise<StoredLineupSummary[]>;
  loadLineupDetails?(lineupId: string): Promise<StoredPoint | undefined>;
  loadLineupMedia?(lineupId: string): Promise<StoredMedia[]>;
  loadResultSpotsWithLineups?(): Promise<StoredResultSpotWithLineups[]>;
  saveResultSpot?(spot: StoredResultSpot): Promise<void>;
  deleteResultSpot?(spotId: string): Promise<void>;
  saveLineupVariant?(lineup: StoredPoint): Promise<void>;
  saveLineupMetadata?(lineup: StoredPoint): Promise<void>;
  deleteLineupVariant?(lineupId: string): Promise<void>;
  loadMediaAssets?(): Promise<StoredMedia[]>;
  addMediaAsset?(media: StoredMedia, mapId?: string): Promise<StoredMedia>;
  loadMediaAssetsForOptimization?(): Promise<StoredMedia[]>;
  updateMediaAssetVariants?(media: StoredMedia): Promise<void>;
  attachMediaToLineup?(lineupId: string, media: StoredMedia, role: MediaRole, sortOrder?: number): Promise<void>;
  getMigrationStatus?(): Promise<StorageMigrationStatus>;
  migrateLegacyData?(contentRoot?: string): Promise<void>;
}

export class WebLineupStorage implements LineupStoragePort {
  private dbPromise: Promise<IDBDatabase> | undefined;
  private readonly memoryPoints = new Map<string, StoredPoint>();
  private readonly memoryPlaylists = new Map<string, StoredPlaylist>();
  private readonly memoryMemberships = new Map<string, Set<string>>();

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
      return Array.from(this.memoryPoints.values());
    }

    const db = await this.openDb();
    const pointRecords = await this.getAll<PointRecord>(db, POINTS_STORE);
    const mediaRecords = await this.getAll<MediaRecord>(db, MEDIA_STORE);

    return pointRecords.map((point) => {
      const mediaById = new Map(mediaRecords
        .filter((media) => media.pointId === point.id)
        .map((media) => [this.mediaAssetId(media), media]));

      const resultSpotId = point.resultSpotId ?? point.id;
      return {
        ...point,
        resultSpotId,
        media: point.media
          .map((media) => mediaById.get(media.id))
          .filter((media): media is MediaRecord => Boolean(media))
          .map((media) => ({
            id: this.mediaAssetId(media),
            name: media.name,
            type: media.type,
            mimeType: media.mimeType,
            blob: media.blob,
            url: URL.createObjectURL(media.blob),
            thumbnailBlob: media.thumbnailBlob,
            thumbnailUrl: media.thumbnailBlob ? URL.createObjectURL(media.thumbnailBlob) : undefined,
            thumbnailMimeType: media.thumbnailMimeType,
            previewBlob: media.previewBlob,
            previewUrl: media.previewBlob ? URL.createObjectURL(media.previewBlob) : undefined,
            previewMimeType: media.previewMimeType,
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

  async loadLineupSummaries(mapId?: string, levelId?: string): Promise<StoredLineupSummary[]> {
    if (!this.hasIndexedDb()) {
      return Array.from(this.memoryPoints.values())
        .filter((point) => (!mapId || point.mapId === mapId) && (!levelId || point.levelId === levelId))
        .map((point) => this.toLineupSummary({
          ...point,
          media: point.media.map(({ id, name, type, mimeType, role }) => ({ id, name, type, mimeType, role })),
        }));
    }

    const db = await this.openDb();
    const pointRecords = await this.getAll<PointRecord>(db, POINTS_STORE);
    return pointRecords
      .filter((point) => (!mapId || point.mapId === mapId) && (!levelId || point.levelId === levelId))
      .map((point) => this.toLineupSummary(point));
  }

  async loadResultSpotLineups(resultSpotId: string, mapId: string, levelId: string): Promise<StoredLineupSummary[]> {
    const summaries = await this.loadLineupSummaries(mapId, levelId);
    return summaries.filter((point) => (point.resultSpotId ?? point.id) === resultSpotId);
  }

  async loadLineupDetails(lineupId: string): Promise<StoredPoint | undefined> {
    if (!this.hasIndexedDb()) {
      return this.memoryPoints.get(lineupId);
    }

    const db = await this.openDb();
    const pointRecords = await this.getAll<PointRecord>(db, POINTS_STORE);
    const point = pointRecords.find((record) => record.id === lineupId);
    if (!point) {
      return undefined;
    }

    return {
      ...point,
      resultSpotId: point.resultSpotId ?? point.id,
      requirements: point.requirements ?? [],
      trajectory: point.trajectory ?? { vertices: [] },
      media: point.media.map((media) => ({
        ...media,
        blob: new Blob(),
        url: '',
        role: media.role ?? 'detail',
        sourceLineupId: point.id,
        sourceLineupTitle: point.title,
      })),
    };
  }

  async loadLineupMedia(lineupId: string): Promise<StoredMedia[]> {
    if (!this.hasIndexedDb()) {
      return this.memoryPoints.get(lineupId)?.media ?? [];
    }

    const db = await this.openDb();
    const pointRecords = await this.getAll<PointRecord>(db, POINTS_STORE);
    const point = pointRecords.find((record) => record.id === lineupId);
    const mediaRecords = await this.getAll<MediaRecord>(db, MEDIA_STORE);
    return mediaRecords
      .filter((media) => media.pointId === lineupId)
      .map((media) => ({
        id: this.mediaAssetId(media),
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob: media.blob,
        url: URL.createObjectURL(media.blob),
        thumbnailBlob: media.thumbnailBlob,
        thumbnailUrl: media.thumbnailBlob ? URL.createObjectURL(media.thumbnailBlob) : undefined,
        thumbnailMimeType: media.thumbnailMimeType,
        previewBlob: media.previewBlob,
        previewUrl: media.previewBlob ? URL.createObjectURL(media.previewBlob) : undefined,
        previewMimeType: media.previewMimeType,
        role: media.role ?? 'detail',
        createdAt: media.createdAt,
        sourceLineupId: media.pointId,
        sourceLineupTitle: point?.title,
      }));
  }

  async savePoint(point: StoredPoint): Promise<void> {
    if (!this.hasIndexedDb()) {
      this.memoryPoints.set(point.id, {
        ...point,
        resultSpotId: point.resultSpotId ?? point.id,
        trajectory: point.trajectory ?? { vertices: [] },
        createdAt: point.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const db = await this.openDb();
    const pointRecord: PointRecord = {
      ...point,
      media: point.media.map(({
        id,
        name,
        type,
        mimeType,
        role,
        thumbnailMimeType,
        previewMimeType,
      }) => ({ id, name, type, mimeType, role: role ?? 'detail', thumbnailMimeType, previewMimeType })),
      trajectory: point.trajectory ?? { vertices: [] },
      resultSpotId: point.resultSpotId ?? point.id,
      createdAt: point.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const mediaRecords: MediaRecord[] = point.media.map((media) => ({
      id: this.mediaRecordId(point.id, media.id),
      mediaId: media.id,
      pointId: point.id,
      name: media.name,
      type: media.type,
      mimeType: media.mimeType,
      blob: media.blob,
      thumbnailBlob: media.thumbnailBlob,
      thumbnailMimeType: media.thumbnailMimeType,
      previewBlob: media.previewBlob,
      previewMimeType: media.previewMimeType,
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

  async saveLineupMetadata(point: StoredPoint): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [POINTS_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(POINTS_STORE).put({
        ...point,
        media: point.media.map(({
          id,
          name,
          type,
          mimeType,
          role,
          thumbnailMimeType,
          previewMimeType,
        }) => ({ id, name, type, mimeType, role: role ?? 'detail', thumbnailMimeType, previewMimeType })),
        trajectory: point.trajectory ?? { vertices: [] },
        resultSpotId: point.resultSpotId ?? point.id,
        createdAt: point.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies PointRecord);
    });
  }

  async deletePoint(pointId: string): Promise<void> {
    if (!this.hasIndexedDb()) {
      this.memoryPoints.delete(pointId);
      for (const lineupIds of this.memoryMemberships.values()) {
        lineupIds.delete(pointId);
      }
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [POINTS_STORE, MEDIA_STORE, PLAYLIST_LINEUPS_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(POINTS_STORE).delete(pointId);
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      mediaStore.index('pointId').openCursor(IDBKeyRange.only(pointId)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      const membershipStore = transaction.objectStore(PLAYLIST_LINEUPS_STORE);
      membershipStore.index('lineupId').openCursor(IDBKeyRange.only(pointId)).onsuccess = (event) => {
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
      this.memoryPoints.clear();
      this.memoryMemberships.clear();
      for (const point of points) {
        this.memoryPoints.set(point.id, point);
      }
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [POINTS_STORE, MEDIA_STORE, PLAYLIST_LINEUPS_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(POINTS_STORE).clear();
      transaction.objectStore(MEDIA_STORE).clear();
      transaction.objectStore(PLAYLIST_LINEUPS_STORE).clear();
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
            id: this.mediaRecordId(point.id, media.id),
            mediaId: media.id,
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
      const mediaId = this.mediaAssetId(media);
      if (!uniqueMedia.has(mediaId)) {
        uniqueMedia.set(mediaId, media);
      }
    }

    return Array.from(uniqueMedia.values())
      .map((media) => ({
        id: this.mediaAssetId(media),
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob: media.blob,
        url: URL.createObjectURL(media.blob),
        thumbnailBlob: media.thumbnailBlob,
        thumbnailUrl: media.thumbnailBlob ? URL.createObjectURL(media.thumbnailBlob) : undefined,
        thumbnailMimeType: media.thumbnailMimeType,
        previewBlob: media.previewBlob,
        previewUrl: media.previewBlob ? URL.createObjectURL(media.previewBlob) : undefined,
        previewMimeType: media.previewMimeType,
        assetOnly: true,
        role: 'detail' as const,
        createdAt: media.createdAt,
        sourceLineupId: media.pointId,
        sourceLineupTitle: titleByPointId.get(media.pointId),
      }))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  async loadMediaAssetsForOptimization(): Promise<StoredMedia[]> {
    return this.loadMediaAssets();
  }

  async addMediaAsset(media: StoredMedia): Promise<StoredMedia> {
    return { ...media, role: 'detail', createdAt: media.createdAt ?? new Date().toISOString() };
  }

  async updateMediaAssetVariants(media: StoredMedia): Promise<void> {
    if (!this.hasIndexedDb()) {
      return;
    }

    const db = await this.openDb();
    const mediaRecords = await this.getAll<MediaRecord>(db, MEDIA_STORE);
    await this.transaction(db, [MEDIA_STORE], 'readwrite', (transaction) => {
      const store = transaction.objectStore(MEDIA_STORE);
      for (const record of mediaRecords) {
        if (this.mediaAssetId(record) !== media.id) {
          continue;
        }
        store.put({
          ...record,
          name: media.name ?? record.name,
          mimeType: media.mimeType ?? record.mimeType,
          blob: media.blob ?? record.blob,
          thumbnailBlob: media.thumbnailBlob ?? record.thumbnailBlob,
          thumbnailMimeType: media.thumbnailMimeType ?? record.thumbnailMimeType,
          previewBlob: media.previewBlob ?? record.previewBlob,
          previewMimeType: media.previewMimeType ?? record.previewMimeType,
        } satisfies MediaRecord);
      }
    });
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

  async loadPlaylists(): Promise<StoredPlaylist[]> {
    if (!this.hasIndexedDb()) {
      return Array.from(this.memoryPlaylists.values());
    }

    const db = await this.openDb();
    const playlists = await this.getAll<PlaylistRecord>(db, PLAYLISTS_STORE);
    return playlists
      .map((playlist) => ({
        ...playlist,
        thumbnailUrl: URL.createObjectURL(playlist.thumbnailBlob),
      }))
      .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
  }

  async savePlaylist(playlist: StoredPlaylist): Promise<void> {
    if (!this.hasIndexedDb()) {
      this.memoryPlaylists.set(playlist.id, {
        ...playlist,
        createdAt: playlist.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const db = await this.openDb();
    await this.transaction(db, [PLAYLISTS_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(PLAYLISTS_STORE).put(this.toPlaylistRecord({
        ...playlist,
        createdAt: playlist.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    });
  }

  async deletePlaylist(playlistId: string, deleteContent = false): Promise<void> {
    if (!this.hasIndexedDb()) {
      const lineupIds = deleteContent ? Array.from(this.memoryMemberships.get(playlistId) ?? []) : [];
      for (const lineupId of lineupIds) {
        this.memoryPoints.delete(lineupId);
      }
      this.memoryPlaylists.delete(playlistId);
      this.memoryMemberships.delete(playlistId);
      return;
    }

    const lineupIds = deleteContent ? await this.loadPlaylistLineupIds(playlistId) : [];
    await Promise.all(lineupIds.map((lineupId) => this.deletePoint(lineupId)));
    const db = await this.openDb();
    await this.transaction(db, [PLAYLISTS_STORE, PLAYLIST_LINEUPS_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(PLAYLISTS_STORE).delete(playlistId);
      const membershipStore = transaction.objectStore(PLAYLIST_LINEUPS_STORE);
      membershipStore.index('playlistId').openCursor(IDBKeyRange.only(playlistId)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }

  async loadPlaylistLineupIds(playlistId: string): Promise<string[]> {
    if (!this.hasIndexedDb()) {
      return Array.from(this.memoryMemberships.get(playlistId) ?? []);
    }

    const memberships = await this.loadMembershipRecords('playlistId', playlistId);
    return memberships.map((membership) => membership.lineupId);
  }

  async loadLineupPlaylistIds(lineupId: string): Promise<string[]> {
    if (!this.hasIndexedDb()) {
      return Array.from(this.memoryMemberships.entries())
        .filter(([, lineupIds]) => lineupIds.has(lineupId))
        .map(([playlistId]) => playlistId);
    }

    const memberships = await this.loadMembershipRecords('lineupId', lineupId);
    return memberships.map((membership) => membership.playlistId);
  }

  async loadPlaylistMemberships(): Promise<Record<string, string[]>> {
    if (!this.hasIndexedDb()) {
      return Object.fromEntries(Array.from(this.memoryMemberships.entries()).map(([playlistId, lineupIds]) => [
        playlistId,
        Array.from(lineupIds),
      ]));
    }

    const db = await this.openDb();
    const memberships = await this.getAll<PlaylistLineupRecord>(db, PLAYLIST_LINEUPS_STORE);
    return this.groupMemberships(memberships);
  }

  async setPlaylistLineups(playlistId: string, lineupIds: string[]): Promise<void> {
    if (!this.hasIndexedDb()) {
      this.memoryMemberships.set(playlistId, new Set(lineupIds));
      return;
    }

    const uniqueLineupIds = Array.from(new Set(lineupIds));
    const db = await this.openDb();
    await this.transaction(db, [PLAYLIST_LINEUPS_STORE], 'readwrite', (transaction) => {
      const store = transaction.objectStore(PLAYLIST_LINEUPS_STORE);
      store.index('playlistId').openCursor(IDBKeyRange.only(playlistId)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
          return;
        }

        for (const lineupId of uniqueLineupIds) {
          store.put(this.playlistLineupRecord(playlistId, lineupId));
        }
      };
    });
  }

  async setLineupPlaylists(lineupId: string, playlistIds: string[]): Promise<void> {
    if (!this.hasIndexedDb()) {
      for (const lineupIds of this.memoryMemberships.values()) {
        lineupIds.delete(lineupId);
      }
      for (const playlistId of playlistIds) {
        const lineupIds = this.memoryMemberships.get(playlistId) ?? new Set<string>();
        lineupIds.add(lineupId);
        this.memoryMemberships.set(playlistId, lineupIds);
      }
      return;
    }

    const uniquePlaylistIds = Array.from(new Set(playlistIds));
    const db = await this.openDb();
    await this.transaction(db, [PLAYLIST_LINEUPS_STORE], 'readwrite', (transaction) => {
      const store = transaction.objectStore(PLAYLIST_LINEUPS_STORE);
      store.index('lineupId').openCursor(IDBKeyRange.only(lineupId)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
          return;
        }

        for (const playlistId of uniquePlaylistIds) {
          store.put(this.playlistLineupRecord(playlistId, lineupId));
        }
      };
    });
  }

  async exportZip(
    points: StoredPoint[],
    maps: StoredMap[] = [],
    playlists: StoredPlaylist[] = [],
    playlistMemberships?: Record<string, string[]>,
  ): Promise<Blob> {
    const zip = new JSZip();
    const contentLineups = new Map<string, ContentLineup[]>();
    const memberships = playlistMemberships ?? await this.loadPlaylistMemberships();
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
      playlists: playlists.map((playlist) => {
        const thumbnailFileName = `Content/Playlists/${this.safeFolderName(playlist.id)}/${this.safeFileName(playlist.thumbnailName)}`;
        zip.file(thumbnailFileName, playlist.thumbnailBlob);
        return {
          id: playlist.id,
          title: playlist.title,
          description: playlist.description,
          thumbnailName: playlist.thumbnailName,
          thumbnailMimeType: playlist.thumbnailMimeType,
          thumbnailFileName,
          lineupIds: memberships[playlist.id] ?? [],
          createdAt: playlist.createdAt,
          updatedAt: playlist.updatedAt,
        };
      }),
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

  async importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[]; playlists: StoredPlaylist[] }> {
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
    const playlists = await Promise.all((manifest.playlists ?? []).map(async (playlist) => {
      const thumbnailFile = zip.file(playlist.thumbnailFileName);
      if (!thumbnailFile) {
        throw new Error(`Playlist thumbnail is missing: ${playlist.thumbnailFileName}`);
      }

      const importedBlob = await thumbnailFile.async('blob');
      const thumbnailBlob = new Blob([importedBlob], { type: playlist.thumbnailMimeType });
      return {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description,
        thumbnailName: playlist.thumbnailName,
        thumbnailMimeType: playlist.thumbnailMimeType,
        thumbnailBlob,
        thumbnailUrl: URL.createObjectURL(thumbnailBlob),
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        lineupIds: playlist.lineupIds ?? [],
      };
    }));

    return {
      maps,
      points: await this.importZip(file),
      playlists,
    };
  }

  private hasIndexedDb(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private openDb(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onupgradeneeded = () => {
        this.ensureWebSchema(request.result, request.transaction);
      };
      request.onsuccess = () => {
        const db = request.result;
        if (db.version < DB_VERSION || !this.hasWebSchema(db)) {
          const nextVersion = Math.max(DB_VERSION, db.version + 1);
          db.close();
          this.openDbVersion(nextVersion).then(resolve, reject);
          return;
        }

        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private openDbVersion(version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, version);
      request.onupgradeneeded = () => {
        this.ensureWebSchema(request.result, request.transaction);
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!this.hasWebSchema(db)) {
          db.close();
          reject(new Error('IndexedDB schema migration failed'));
          return;
        }

        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB schema migration is blocked by another open app tab'));
    });
  }

  private hasWebSchema(db: IDBDatabase): boolean {
    if (!db.objectStoreNames.contains(POINTS_STORE)
      || !db.objectStoreNames.contains(MEDIA_STORE)
      || !db.objectStoreNames.contains(MAPS_STORE)
      || !db.objectStoreNames.contains(PLAYLISTS_STORE)
      || !db.objectStoreNames.contains(PLAYLIST_LINEUPS_STORE)) {
      return false;
    }

    const transaction = db.transaction([MEDIA_STORE, PLAYLIST_LINEUPS_STORE], 'readonly');
    const mediaStore = transaction.objectStore(MEDIA_STORE);
    const membershipStore = transaction.objectStore(PLAYLIST_LINEUPS_STORE);
    return mediaStore.indexNames.contains('pointId')
      && membershipStore.indexNames.contains('playlistId')
      && membershipStore.indexNames.contains('lineupId');
  }

  private ensureWebSchema(db: IDBDatabase, transaction: IDBTransaction | null): void {
    if (!db.objectStoreNames.contains(POINTS_STORE)) {
      db.createObjectStore(POINTS_STORE, { keyPath: 'id' });
    }
    const mediaStore = db.objectStoreNames.contains(MEDIA_STORE)
      ? transaction?.objectStore(MEDIA_STORE)
      : db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
    if (mediaStore && !mediaStore.indexNames.contains('pointId')) {
      mediaStore.createIndex('pointId', 'pointId', { unique: false });
    }
    if (!db.objectStoreNames.contains(MAPS_STORE)) {
      db.createObjectStore(MAPS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
      db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
    }
    const membershipStore = db.objectStoreNames.contains(PLAYLIST_LINEUPS_STORE)
      ? transaction?.objectStore(PLAYLIST_LINEUPS_STORE)
      : db.createObjectStore(PLAYLIST_LINEUPS_STORE, { keyPath: 'id' });
    if (membershipStore && !membershipStore.indexNames.contains('playlistId')) {
      membershipStore.createIndex('playlistId', 'playlistId', { unique: false });
    }
    if (membershipStore && !membershipStore.indexNames.contains('lineupId')) {
      membershipStore.createIndex('lineupId', 'lineupId', { unique: false });
    }
  }

  private mediaAssetId(media: Pick<MediaRecord, 'id' | 'mediaId'>): string {
    return media.mediaId ?? media.id;
  }

  private mediaRecordId(pointId: string, mediaId: string): string {
    return `${pointId}:${mediaId}`;
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

  private async loadMembershipRecords(indexName: 'playlistId' | 'lineupId', value: string): Promise<PlaylistLineupRecord[]> {
    if (!this.hasIndexedDb()) {
      return [];
    }

    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(PLAYLIST_LINEUPS_STORE, 'readonly')
        .objectStore(PLAYLIST_LINEUPS_STORE)
        .index(indexName)
        .getAll(IDBKeyRange.only(value));
      request.onsuccess = () => resolve(request.result as PlaylistLineupRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  private playlistLineupRecord(playlistId: string, lineupId: string): PlaylistLineupRecord {
    return {
      id: `${playlistId}:${lineupId}`,
      playlistId,
      lineupId,
    };
  }

  private groupMemberships(memberships: PlaylistLineupRecord[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    for (const membership of memberships) {
      grouped[membership.playlistId] = [...(grouped[membership.playlistId] ?? []), membership.lineupId];
    }
    return grouped;
  }

  private toPlaylistRecord(playlist: StoredPlaylist): PlaylistRecord {
    const { thumbnailUrl, lineupIds, ...record } = playlist;
    void thumbnailUrl;
    void lineupIds;
    return record;
  }

  private toLineupSummary(point: PointRecord): StoredLineupSummary {
    const mediaRoles = Array.from(new Set(point.media.map((media) => media.role ?? 'detail')));
    return {
      ...point,
      resultSpotId: point.resultSpotId ?? point.id,
      media: [],
      requirements: [],
      trajectory: { vertices: [] },
      mediaCount: point.media.length,
      mediaRoles,
      hasTrajectory: Boolean(point.trajectory?.vertices.length),
    };
  }

  private pointsToResultSpots(points: StoredPoint[]): StoredResultSpotWithLineups[] {
    const groups = new Map<string, StoredPoint[]>();
    for (const point of points) {
      const resultSpotId = point.resultSpotId ?? point.id;
      const groupKey = `${point.mapId}:${point.levelId}:${resultSpotId}`;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), { ...point, resultSpotId }]);
    }

    return Array.from(groups.values()).map((lineups) => {
      const firstLineup = lineups[0];
      return {
        id: firstLineup.resultSpotId ?? firstLineup.id,
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

  private contentMediaPath(point: StoredPoint, media: StoredMedia, variant?: 'thumb' | 'preview'): string {
    const role = media.role ?? 'detail';
    const variantPrefix = variant ? `${variant}-` : '';
    return [
      'Content',
      'Maps',
      this.safeFolderName(point.mapId),
      'User',
      'Media',
      '_Pool',
      `${variantPrefix}${role}-${this.safeFileName(media.id)}-${this.safeFileName(media.name)}`,
    ].join('/');
  }

  private derivativeMediaPath(originalPath: string, variant: 'thumb' | 'preview' | 'large', mimeType?: string): string {
    const normalizedPath = originalPath.replace(/\\/g, '/');
    const slashIndex = normalizedPath.lastIndexOf('/');
    const directory = slashIndex >= 0 ? normalizedPath.slice(0, slashIndex) : '';
    const fileName = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
    const nextFileName = mimeType ? this.fileNameWithMimeType(fileName, mimeType) : fileName;
    return [directory, `${variant}-${nextFileName}`].filter(Boolean).join('/');
  }

  private fileNameWithMimeType(fileName: string, mimeType: string): string {
    const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : '';
    if (!extension) {
      return fileName;
    }
    const baseName = fileName.replace(/\.[^.\\/]+$/, '') || 'image';
    return `${baseName}.${extension}`;
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
  thumbnailPath?: string;
  previewPath?: string;
  sortOrder: number;
  createdAt?: string;
  sourceLineupId?: string;
  sourceLineupTitle?: string;
};

type MapRow = Omit<StoredMap, 'imageBlob' | 'imageUrl'> & {
  imagePath: string;
};

type PlaylistRow = Omit<StoredPlaylist, 'thumbnailBlob' | 'thumbnailUrl'> & {
  thumbnailPath: string;
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
        media_assets.thumbnailPath, media_assets.thumbnailMimeType, media_assets.previewPath, media_assets.previewMimeType,
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
        const thumbnailBlob = media.thumbnailPath && media.thumbnailMimeType
          ? await this.readBlob(workspace.rootDir, media.thumbnailPath, media.thumbnailMimeType)
          : undefined;
        const previewBlob = media.previewPath && media.previewMimeType
          ? await this.readBlob(workspace.rootDir, media.previewPath, media.previewMimeType)
          : undefined;
        return {
          id: media.id,
          name: media.name,
          type: media.type,
          mimeType: media.mimeType,
          blob,
          url: URL.createObjectURL(blob),
          thumbnailBlob,
          thumbnailUrl: thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined,
          thumbnailMimeType: media.thumbnailMimeType,
          previewBlob,
          previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined,
          previewMimeType: media.previewMimeType,
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

  async loadLineupSummaries(mapId?: string, levelId?: string): Promise<StoredLineupSummary[]> {
    const db = await this.db();
    const filters: string[] = [];
    const params: string[] = [];
    if (mapId) {
      params.push(mapId);
      filters.push(`lineups.mapId = $${params.length}`);
    }
    if (levelId) {
      params.push(levelId);
      filters.push(`lineups.levelId = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await db.select<Array<LineupRow & { mediaCount?: number; mediaRoles?: string }>>(
      `SELECT lineups.*,
        COUNT(lineup_media.mediaId) AS mediaCount,
        GROUP_CONCAT(DISTINCT lineup_media.role) AS mediaRoles
      FROM lineups
      LEFT JOIN lineup_media ON lineup_media.lineupId = lineups.id
      ${where}
      GROUP BY lineups.id
      ORDER BY lineups.id`,
      params,
    );

    return rows.map((lineup) => this.toLineupSummary(lineup));
  }

  async loadResultSpotLineups(resultSpotId: string, mapId: string, levelId: string): Promise<StoredLineupSummary[]> {
    const rows = await this.loadLineupSummaries(mapId, levelId);
    return rows.filter((lineup) => (lineup.resultSpotId ?? lineup.id) === resultSpotId);
  }

  async loadLineupDetails(lineupId: string): Promise<StoredPoint | undefined> {
    const db = await this.db();
    const lineups = await db.select<LineupRow[]>('SELECT * FROM lineups WHERE id = $1 LIMIT 1', [lineupId]);
    const lineup = lineups[0];
    if (!lineup) {
      return undefined;
    }

    const mediaRows = await db.select<Array<MediaRow & { lineupId: string }>>(
      `SELECT media_assets.id, media_assets.name, media_assets.type, media_assets.mimeType, media_assets.path,
        media_assets.thumbnailPath, media_assets.thumbnailMimeType, media_assets.previewPath, media_assets.previewMimeType,
        media_assets.createdAt, lineup_media.role, lineup_media.sortOrder, lineup_media.lineupId
      FROM lineup_media
      JOIN media_assets ON media_assets.id = lineup_media.mediaId
      WHERE lineup_media.lineupId = $1
      ORDER BY lineup_media.sortOrder`,
      [lineupId],
    );

    return {
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
      media: mediaRows.map((media) => ({
        id: media.id,
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob: new Blob(),
        url: '',
        role: media.role ?? 'detail',
        createdAt: media.createdAt,
        sourceLineupId: media.lineupId,
        sourceLineupTitle: lineup.title,
      })),
      createdAt: lineup.createdAt,
      updatedAt: lineup.updatedAt,
    };
  }

  async loadLineupMedia(lineupId: string): Promise<StoredMedia[]> {
    const db = await this.db();
    const workspace = await this.workspace();
    const rows = await db.select<Array<MediaRow & { lineupId: string; sourceLineupTitle?: string }>>(
      `SELECT media_assets.id, media_assets.name, media_assets.type, media_assets.mimeType, media_assets.path,
        media_assets.thumbnailPath, media_assets.thumbnailMimeType, media_assets.previewPath, media_assets.previewMimeType,
        media_assets.createdAt, lineup_media.role, lineup_media.sortOrder, lineup_media.lineupId,
        lineups.title AS sourceLineupTitle
      FROM lineup_media
      JOIN media_assets ON media_assets.id = lineup_media.mediaId
      LEFT JOIN lineups ON lineups.id = lineup_media.lineupId
      WHERE lineup_media.lineupId = $1
      ORDER BY lineup_media.sortOrder`,
      [lineupId],
    );

    return Promise.all(rows.map(async (media) => {
      const blob = await this.readBlob(workspace.rootDir, media.path, media.mimeType);
      const thumbnailBlob = media.thumbnailPath && media.thumbnailMimeType
        ? await this.readBlob(workspace.rootDir, media.thumbnailPath, media.thumbnailMimeType)
        : undefined;
      const previewBlob = media.previewPath && media.previewMimeType
        ? await this.readBlob(workspace.rootDir, media.previewPath, media.previewMimeType)
        : undefined;
      return {
        id: media.id,
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob,
        url: URL.createObjectURL(blob),
        thumbnailBlob,
        thumbnailUrl: thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined,
        thumbnailMimeType: media.thumbnailMimeType,
        previewBlob,
        previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined,
        previewMimeType: media.previewMimeType,
        role: media.role ?? 'detail',
        createdAt: media.createdAt,
        sourceLineupId: media.lineupId,
        sourceLineupTitle: media.sourceLineupTitle,
      } satisfies StoredMedia;
    }));
  }

  async savePoint(point: StoredPoint): Promise<void> {
    const db = await this.db();
    const workspace = await this.workspace([point.mapId]);
    await this.upsertLineup(db, point);
    await db.execute('DELETE FROM lineup_media WHERE lineupId = $1', [point.id]);
    await Promise.all(point.media.map(async (media, index) => {
      const path = this.contentMediaPath(point, media);
      const thumbnailPath = media.thumbnailBlob ? this.contentMediaPath(point, media, 'thumb') : null;
      const previewPath = media.previewBlob ? this.contentMediaPath(point, media, 'preview') : null;
      if (!media.assetOnly) {
        await this.writeBlob(workspace.rootDir, path, media.blob);
        if (thumbnailPath && media.thumbnailBlob) {
          await this.writeBlob(workspace.rootDir, thumbnailPath, media.thumbnailBlob);
        }
        if (previewPath && media.previewBlob) {
          await this.writeBlob(workspace.rootDir, previewPath, media.previewBlob);
        }
        await db.execute(
          `INSERT INTO media_assets (
            id, name, type, mimeType, path, thumbnailPath, thumbnailMimeType, previewPath, previewMimeType, checksum, createdAt
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            type=excluded.type,
            mimeType=excluded.mimeType,
            path=excluded.path,
            thumbnailPath=COALESCE(excluded.thumbnailPath, media_assets.thumbnailPath),
            thumbnailMimeType=COALESCE(excluded.thumbnailMimeType, media_assets.thumbnailMimeType),
            previewPath=COALESCE(excluded.previewPath, media_assets.previewPath),
            previewMimeType=COALESCE(excluded.previewMimeType, media_assets.previewMimeType)`,
          [
            media.id,
            media.name,
            media.type,
            media.mimeType,
            path,
            thumbnailPath,
            media.thumbnailMimeType ?? null,
            previewPath,
            media.previewMimeType ?? null,
            '',
            media.createdAt ?? new Date().toISOString(),
          ],
        );
      }
      await db.execute(
        `INSERT INTO lineup_media (lineupId, mediaId, role, sortOrder)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT(lineupId, mediaId) DO UPDATE SET role=excluded.role, sortOrder=excluded.sortOrder`,
        [point.id, media.id, media.role ?? 'detail', index],
      );
    }));
  }

  async saveLineupMetadata(point: StoredPoint): Promise<void> {
    const db = await this.db();
    await this.upsertLineup(db, point);
  }

  async deletePoint(pointId: string): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM playlist_lineups WHERE lineupId = $1', [pointId]);
    await db.execute('DELETE FROM lineup_media WHERE lineupId = $1', [pointId]);
    await db.execute('DELETE FROM lineups WHERE id = $1', [pointId]);
  }

  async replaceAll(points: StoredPoint[]): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM playlist_lineups');
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

  async loadPlaylists(): Promise<StoredPlaylist[]> {
    const db = await this.db();
    const workspace = await this.workspace();
    const rows = await db.select<PlaylistRow[]>('SELECT * FROM playlists ORDER BY updatedAt DESC, createdAt DESC');
    return Promise.all(rows.map(async (row) => {
      const blob = await this.readBlob(workspace.rootDir, row.thumbnailPath, row.thumbnailMimeType);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        thumbnailName: row.thumbnailName,
        thumbnailMimeType: row.thumbnailMimeType,
        thumbnailBlob: blob,
        thumbnailUrl: URL.createObjectURL(blob),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }));
  }

  async savePlaylist(playlist: StoredPlaylist): Promise<void> {
    const db = await this.db();
    const workspace = await this.workspace(['playlists']);
    const now = new Date().toISOString();
    const thumbnailPath = `Content/Playlists/${this.safeFolderName(playlist.id)}/${this.safeFileName(playlist.thumbnailName)}`;
    await this.writeBlob(workspace.rootDir, thumbnailPath, playlist.thumbnailBlob);
    await db.execute(
      `INSERT INTO playlists (
        id, title, description, thumbnailName, thumbnailMimeType, thumbnailPath, createdAt, updatedAt
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        thumbnailName=excluded.thumbnailName,
        thumbnailMimeType=excluded.thumbnailMimeType,
        thumbnailPath=excluded.thumbnailPath,
        updatedAt=excluded.updatedAt`,
      [
        playlist.id,
        playlist.title,
        playlist.description,
        playlist.thumbnailName,
        playlist.thumbnailMimeType,
        thumbnailPath,
        playlist.createdAt ?? now,
        now,
      ],
    );
  }

  async deletePlaylist(playlistId: string, deleteContent = false): Promise<void> {
    const lineupIds = deleteContent ? await this.loadPlaylistLineupIds(playlistId) : [];
    await Promise.all(lineupIds.map((lineupId) => this.deletePoint(lineupId)));
    const db = await this.db();
    await db.execute('DELETE FROM playlist_lineups WHERE playlistId = $1', [playlistId]);
    await db.execute('DELETE FROM playlists WHERE id = $1', [playlistId]);
  }

  async loadPlaylistLineupIds(playlistId: string): Promise<string[]> {
    const db = await this.db();
    const rows = await db.select<Array<{ lineupId: string }>>(
      'SELECT lineupId FROM playlist_lineups WHERE playlistId = $1 ORDER BY lineupId',
      [playlistId],
    );
    return rows.map((row) => row.lineupId);
  }

  async loadLineupPlaylistIds(lineupId: string): Promise<string[]> {
    const db = await this.db();
    const rows = await db.select<Array<{ playlistId: string }>>(
      'SELECT playlistId FROM playlist_lineups WHERE lineupId = $1 ORDER BY playlistId',
      [lineupId],
    );
    return rows.map((row) => row.playlistId);
  }

  async loadPlaylistMemberships(): Promise<Record<string, string[]>> {
    const db = await this.db();
    const rows = await db.select<Array<{ playlistId: string; lineupId: string }>>(
      'SELECT playlistId, lineupId FROM playlist_lineups ORDER BY playlistId, lineupId',
    );
    const grouped: Record<string, string[]> = {};
    for (const row of rows) {
      grouped[row.playlistId] = [...(grouped[row.playlistId] ?? []), row.lineupId];
    }
    return grouped;
  }

  async setPlaylistLineups(playlistId: string, lineupIds: string[]): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM playlist_lineups WHERE playlistId = $1', [playlistId]);
    for (const lineupId of Array.from(new Set(lineupIds))) {
      await db.execute(
        `INSERT INTO playlist_lineups (playlistId, lineupId)
        VALUES ($1,$2)
        ON CONFLICT(playlistId, lineupId) DO NOTHING`,
        [playlistId, lineupId],
      );
    }
  }

  async setLineupPlaylists(lineupId: string, playlistIds: string[]): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM playlist_lineups WHERE lineupId = $1', [lineupId]);
    for (const playlistId of Array.from(new Set(playlistIds))) {
      await db.execute(
        `INSERT INTO playlist_lineups (playlistId, lineupId)
        VALUES ($1,$2)
        ON CONFLICT(playlistId, lineupId) DO NOTHING`,
        [playlistId, lineupId],
      );
    }
  }

  async loadMediaAssets(): Promise<StoredMedia[]> {
    const db = await this.db();
    const workspace = await this.workspace();
    const rows = await db.select<Array<MediaRow & { sourceLineupTitle?: string }>>(
      `SELECT media_assets.id, media_assets.name, media_assets.type, media_assets.mimeType,
        media_assets.path, media_assets.thumbnailPath, media_assets.thumbnailMimeType,
        media_assets.previewPath, media_assets.previewMimeType,
        media_assets.createdAt, lineup_media.lineupId AS sourceLineupId,
        lineups.title AS sourceLineupTitle, 'detail' AS role, 0 AS sortOrder
      FROM media_assets
      LEFT JOIN lineup_media ON lineup_media.mediaId = media_assets.id
      LEFT JOIN lineups ON lineups.id = lineup_media.lineupId
      GROUP BY media_assets.id
      ORDER BY media_assets.createdAt DESC`,
    );

    return Promise.all(rows.map(async (media) => {
      const thumbnailBlob = media.thumbnailPath && media.thumbnailMimeType
        ? await this.readBlob(workspace.rootDir, media.thumbnailPath, media.thumbnailMimeType)
        : undefined;
      const previewBlob = media.previewPath && media.previewMimeType
        ? await this.readBlob(workspace.rootDir, media.previewPath, media.previewMimeType)
        : undefined;
      const blob = thumbnailBlob ?? previewBlob ?? await this.readBlob(workspace.rootDir, media.path, media.mimeType);
      return {
        id: media.id,
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob,
        url: URL.createObjectURL(blob),
        thumbnailBlob,
        thumbnailUrl: thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined,
        thumbnailMimeType: media.thumbnailMimeType,
        previewBlob,
        previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined,
        previewMimeType: media.previewMimeType,
        assetOnly: true,
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
    const thumbnailPath = mediaAsset.thumbnailBlob ? this.contentMediaPath({ mapId } as StoredPoint, mediaAsset, 'thumb') : null;
    const previewPath = mediaAsset.previewBlob ? this.contentMediaPath({ mapId } as StoredPoint, mediaAsset, 'preview') : null;
    await this.writeBlob(workspace.rootDir, path, mediaAsset.blob);
    if (thumbnailPath && mediaAsset.thumbnailBlob) {
      await this.writeBlob(workspace.rootDir, thumbnailPath, mediaAsset.thumbnailBlob);
    }
    if (previewPath && mediaAsset.previewBlob) {
      await this.writeBlob(workspace.rootDir, previewPath, mediaAsset.previewBlob);
    }
    await db.execute(
      `INSERT INTO media_assets (
        id, name, type, mimeType, path, thumbnailPath, thumbnailMimeType, previewPath, previewMimeType, checksum, createdAt
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        mimeType=excluded.mimeType,
        path=excluded.path,
        thumbnailPath=COALESCE(excluded.thumbnailPath, media_assets.thumbnailPath),
        thumbnailMimeType=COALESCE(excluded.thumbnailMimeType, media_assets.thumbnailMimeType),
        previewPath=COALESCE(excluded.previewPath, media_assets.previewPath),
        previewMimeType=COALESCE(excluded.previewMimeType, media_assets.previewMimeType)`,
      [
        mediaAsset.id,
        mediaAsset.name,
        mediaAsset.type,
        mediaAsset.mimeType,
        path,
        thumbnailPath,
        mediaAsset.thumbnailMimeType ?? null,
        previewPath,
        mediaAsset.previewMimeType ?? null,
        '',
        mediaAsset.createdAt,
      ],
    );
    return mediaAsset;
  }

  async loadMediaAssetsForOptimization(): Promise<StoredMedia[]> {
    const db = await this.db();
    const workspace = await this.workspace();
    const rows = await db.select<Array<MediaRow & { sourceLineupTitle?: string }>>(
      `SELECT media_assets.id, media_assets.name, media_assets.type, media_assets.mimeType,
        media_assets.path, media_assets.thumbnailPath, media_assets.thumbnailMimeType,
        media_assets.previewPath, media_assets.previewMimeType,
        media_assets.createdAt, lineup_media.lineupId AS sourceLineupId,
        lineups.title AS sourceLineupTitle, 'detail' AS role, 0 AS sortOrder
      FROM media_assets
      LEFT JOIN lineup_media ON lineup_media.mediaId = media_assets.id
      LEFT JOIN lineups ON lineups.id = lineup_media.lineupId
      GROUP BY media_assets.id
      ORDER BY media_assets.createdAt DESC`,
    );

    return Promise.all(rows.map(async (media) => {
      const blob = await this.readBlob(workspace.rootDir, media.path, media.mimeType);
      const thumbnailBlob = media.thumbnailPath && media.thumbnailMimeType
        ? await this.readBlob(workspace.rootDir, media.thumbnailPath, media.thumbnailMimeType)
        : undefined;
      const previewBlob = media.previewPath && media.previewMimeType
        ? await this.readBlob(workspace.rootDir, media.previewPath, media.previewMimeType)
        : undefined;
      return {
        id: media.id,
        name: media.name,
        type: media.type,
        mimeType: media.mimeType,
        blob,
        url: URL.createObjectURL(blob),
        thumbnailBlob,
        thumbnailUrl: thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined,
        thumbnailMimeType: media.thumbnailMimeType,
        previewBlob,
        previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined,
        previewMimeType: media.previewMimeType,
        role: 'detail',
        createdAt: media.createdAt,
        sourceLineupId: media.sourceLineupId,
        sourceLineupTitle: media.sourceLineupTitle,
      } satisfies StoredMedia;
    }));
  }

  async updateMediaAssetVariants(media: StoredMedia): Promise<void> {
    if (!media.blob && !media.thumbnailBlob && !media.previewBlob) {
      return;
    }

    const db = await this.db();
    const workspace = await this.workspace();
    const rows = await db.select<Array<{ path: string; mimeType: string }>>(
      'SELECT path, mimeType FROM media_assets WHERE id = $1 LIMIT 1',
      [media.id],
    );
    const originalPath = rows[0]?.path;
    if (!originalPath) {
      return;
    }

    const compressedPath = media.blob && media.mimeType !== rows[0]?.mimeType
      ? this.derivativeMediaPath(originalPath, 'large', media.mimeType)
      : null;
    const thumbnailPath = media.thumbnailBlob ? this.derivativeMediaPath(originalPath, 'thumb') : null;
    const previewPath = media.previewBlob ? this.derivativeMediaPath(originalPath, 'preview') : null;
    if (compressedPath && media.blob) {
      await this.writeBlob(workspace.rootDir, compressedPath, media.blob);
    }
    if (thumbnailPath && media.thumbnailBlob) {
      await this.writeBlob(workspace.rootDir, thumbnailPath, media.thumbnailBlob);
    }
    if (previewPath && media.previewBlob) {
      await this.writeBlob(workspace.rootDir, previewPath, media.previewBlob);
    }

    await db.execute(
      `UPDATE media_assets SET
        name=COALESCE($2, name),
        mimeType=COALESCE($3, mimeType),
        path=COALESCE($4, path),
        thumbnailPath=COALESCE($5, thumbnailPath),
        thumbnailMimeType=COALESCE($6, thumbnailMimeType),
        previewPath=COALESCE($7, previewPath),
        previewMimeType=COALESCE($8, previewMimeType)
      WHERE id = $1`,
      [
        media.id,
        compressedPath ? media.name : null,
        compressedPath ? media.mimeType : null,
        compressedPath,
        thumbnailPath,
        media.thumbnailMimeType ?? null,
        previewPath,
        media.previewMimeType ?? null,
      ],
    );
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

  exportZip(
    points: StoredPoint[],
    maps: StoredMap[] = [],
    playlists: StoredPlaylist[] = [],
    playlistMemberships: Record<string, string[]> = {},
  ): Promise<Blob> {
    return this.zipStorage.exportZip(points, maps, playlists, playlistMemberships);
  }

  importZip(file: File): Promise<StoredPoint[]> {
    return this.zipStorage.importZip(file);
  }

  importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[]; playlists?: StoredPlaylist[] }> {
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
      thumbnailPath TEXT,
      thumbnailMimeType TEXT,
      previewPath TEXT,
      previewMimeType TEXT,
      checksum TEXT,
      createdAt TEXT NOT NULL
    )`);
    await this.addColumnIfMissing(db, 'media_assets', 'thumbnailPath TEXT');
    await this.addColumnIfMissing(db, 'media_assets', 'thumbnailMimeType TEXT');
    await this.addColumnIfMissing(db, 'media_assets', 'previewPath TEXT');
    await this.addColumnIfMissing(db, 'media_assets', 'previewMimeType TEXT');
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
    await db.execute(`CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      thumbnailName TEXT NOT NULL,
      thumbnailMimeType TEXT NOT NULL,
      thumbnailPath TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS playlist_lineups (
      playlistId TEXT NOT NULL,
      lineupId TEXT NOT NULL,
      PRIMARY KEY (playlistId, lineupId)
    )`);
    await db.execute('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await db.execute(
      `INSERT INTO app_meta (key, value) VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      ['schemaVersion', '4'],
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

  private toLineupSummary(lineup: LineupRow & { mediaCount?: number; mediaRoles?: string }): StoredLineupSummary {
    const trajectory = this.parseJson<StoredTrajectory>(lineup.trajectoryJson, { vertices: [] });
    return {
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
      heroMediaId: lineup.heroMediaId,
      requirements: [],
      media: [],
      trajectory: { vertices: [] },
      mediaCount: Number(lineup.mediaCount ?? 0),
      mediaRoles: (lineup.mediaRoles ?? '')
        .split(',')
        .filter((role): role is MediaRole => role === 'start' || role === 'aim' || role === 'result' || role === 'detail'),
      hasTrajectory: trajectory.vertices.length > 0,
      createdAt: lineup.createdAt,
      updatedAt: lineup.updatedAt,
    };
  }

  private safeFolderName(name: string): string {
    const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim();
    return safeName || '_Unknown';
  }

  private pointsToResultSpots(points: StoredPoint[]): StoredResultSpotWithLineups[] {
    const groups = new Map<string, StoredPoint[]>();
    for (const point of points) {
      const resultSpotId = point.resultSpotId ?? point.id;
      const groupKey = `${point.mapId}:${point.levelId}:${resultSpotId}`;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), { ...point, resultSpotId }]);
    }

    return Array.from(groups.values()).map((lineups) => {
      const firstLineup = lineups[0];
      return {
        id: firstLineup.resultSpotId ?? firstLineup.id,
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

  private contentMediaPath(point: StoredPoint, media: StoredMedia, variant?: 'thumb' | 'preview'): string {
    const role = media.role ?? 'detail';
    const variantPrefix = variant ? `${variant}-` : '';
    return [
      'Content',
      'Maps',
      this.safeFolderName(point.mapId),
      'User',
      'Media',
      '_Pool',
      `${variantPrefix}${role}-${this.safeFileName(media.id)}-${this.safeFileName(media.name)}`,
    ].join('/');
  }

  private derivativeMediaPath(originalPath: string, variant: 'thumb' | 'preview' | 'large', mimeType?: string): string {
    const normalizedPath = originalPath.replace(/\\/g, '/');
    const slashIndex = normalizedPath.lastIndexOf('/');
    const directory = slashIndex >= 0 ? normalizedPath.slice(0, slashIndex) : '';
    const fileName = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
    const nextFileName = mimeType ? this.fileNameWithMimeType(fileName, mimeType) : fileName;
    return [directory, `${variant}-${nextFileName}`].filter(Boolean).join('/');
  }

  private fileNameWithMimeType(fileName: string, mimeType: string): string {
    const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : '';
    if (!extension) {
      return fileName;
    }
    const baseName = fileName.replace(/\.[^.\\/]+$/, '') || 'image';
    return `${baseName}.${extension}`;
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

  async exportZip(
    points: StoredPoint[],
    maps: StoredMap[] = [],
    playlists: StoredPlaylist[] = [],
    playlistMemberships: Record<string, string[]> = {},
  ): Promise<Blob> {
    return this.activeStorage().then((storage) => storage.exportZip(points, maps, playlists, playlistMemberships));
  }

  async importZip(file: File): Promise<StoredPoint[]> {
    return this.activeStorage().then((storage) => storage.importZip(file));
  }

  async importZipData(file: File): Promise<{ maps: StoredMap[]; points: StoredPoint[]; playlists?: StoredPlaylist[] }> {
    return this.activeStorage().then((storage) => storage.importZipData(file));
  }

  async loadPlaylists(): Promise<StoredPlaylist[]> {
    const storage = await this.activeStorage();
    return storage.loadPlaylists?.() ?? [];
  }

  async savePlaylist(playlist: StoredPlaylist): Promise<void> {
    const storage = await this.activeStorage();
    await storage.savePlaylist?.(playlist);
  }

  async deletePlaylist(playlistId: string, deleteContent = false): Promise<void> {
    const storage = await this.activeStorage();
    await storage.deletePlaylist?.(playlistId, deleteContent);
  }

  async loadPlaylistLineupIds(playlistId: string): Promise<string[]> {
    const storage = await this.activeStorage();
    return storage.loadPlaylistLineupIds?.(playlistId) ?? [];
  }

  async loadLineupPlaylistIds(lineupId: string): Promise<string[]> {
    const storage = await this.activeStorage();
    return storage.loadLineupPlaylistIds?.(lineupId) ?? [];
  }

  async loadPlaylistMemberships(): Promise<Record<string, string[]>> {
    const storage = await this.activeStorage();
    return storage.loadPlaylistMemberships?.() ?? {};
  }

  async setPlaylistLineups(playlistId: string, lineupIds: string[]): Promise<void> {
    const storage = await this.activeStorage();
    await storage.setPlaylistLineups?.(playlistId, lineupIds);
  }

  async setLineupPlaylists(lineupId: string, playlistIds: string[]): Promise<void> {
    const storage = await this.activeStorage();
    await storage.setLineupPlaylists?.(lineupId, playlistIds);
  }

  async loadLineupSummaries(mapId?: string, levelId?: string): Promise<StoredLineupSummary[]> {
    const storage = await this.activeStorage();
    return storage.loadLineupSummaries?.(mapId, levelId) ?? storage.loadPoints();
  }

  async loadResultSpotLineups(resultSpotId: string, mapId: string, levelId: string): Promise<StoredLineupSummary[]> {
    const storage = await this.activeStorage();
    if (storage.loadResultSpotLineups) {
      return storage.loadResultSpotLineups(resultSpotId, mapId, levelId);
    }

    const points = await storage.loadPoints();
    return points.filter((point) => (
      (point.resultSpotId ?? point.id) === resultSpotId &&
      point.mapId === mapId &&
      point.levelId === levelId
    ));
  }

  async loadLineupDetails(lineupId: string): Promise<StoredPoint | undefined> {
    const storage = await this.activeStorage();
    if (storage.loadLineupDetails) {
      return storage.loadLineupDetails(lineupId);
    }

    return (await storage.loadPoints()).find((point) => point.id === lineupId);
  }

  async loadLineupMedia(lineupId: string): Promise<StoredMedia[]> {
    const storage = await this.activeStorage();
    if (storage.loadLineupMedia) {
      return storage.loadLineupMedia(lineupId);
    }

    return (await storage.loadPoints()).find((point) => point.id === lineupId)?.media ?? [];
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

  async saveLineupMetadata(lineup: StoredPoint): Promise<void> {
    const storage = await this.activeStorage();
    await (storage.saveLineupMetadata?.(lineup) ?? storage.savePoint(lineup));
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

  async loadMediaAssetsForOptimization(): Promise<StoredMedia[]> {
    const storage = await this.activeStorage();
    return storage.loadMediaAssetsForOptimization?.() ?? storage.loadMediaAssets?.() ?? [];
  }

  async updateMediaAssetVariants(media: StoredMedia): Promise<void> {
    const storage = await this.activeStorage();
    await storage.updateMediaAssetVariants?.(media);
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
