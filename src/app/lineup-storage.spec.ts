import { LineupStorage, StoredMap, StoredPoint, StoredResultSpotWithLineups, WebLineupStorage } from './lineup-storage';
import JSZip from 'jszip';

describe('LineupStorage', () => {
  it('should use web storage fallback outside Tauri', async () => {
    const storage = new LineupStorage();
    await expect(storage.getMigrationStatus()).resolves.toMatchObject({
      isDesktop: false,
      needsMigration: false,
    });
  });

  it('should export and import a ZIP manifest with media', async () => {
    const storage = new LineupStorage();
    const point: StoredPoint = {
      id: 'dust2:main:custom:1',
      label: '1',
      mapId: 'dust2',
      levelId: 'main',
      x: 50,
      y: 55,
      kind: 'custom',
      grenadeCategoryId: 'smoke',
      teamSide: 'ct',
      title: 'Window smoke',
      description: 'Stand on Xbox and aim at the corner.',
      requirements: ['jump', 'left-click'],
      heroMediaId: 'media-2',
      trajectory: {
        vertices: [
          { id: 'vertex-1', x: 40, y: 45 },
          { id: 'vertex-2', x: 30, y: 35 },
        ],
      },
      media: [
        {
          id: 'media-1',
          name: 'lineup.png',
          type: 'image',
          mimeType: 'image/png',
          blob: new Blob(['image-bytes'], { type: 'image/png' }),
          url: 'blob:test',
          role: 'start',
        },
        {
          id: 'media-2',
          name: 'hero.png',
          type: 'image',
          mimeType: 'image/png',
          blob: new Blob(['hero-bytes'], { type: 'image/png' }),
          url: 'blob:hero',
          role: 'result',
        },
      ],
    };

    const zipBlob = await storage.exportZip([point]);
    const imported = await storage.importZip(new File([zipBlob], 'lineups.zip', { type: 'application/zip' }));

    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe('Window smoke');
    expect(imported[0].description).toBe('Stand on Xbox and aim at the corner.');
    expect(imported[0].teamSide).toBe('ct');
    expect(imported[0].heroMediaId).toBe('media-2');
    expect(imported[0].trajectory?.vertices.map((vertex) => vertex.id)).toEqual(['vertex-1', 'vertex-2']);
    expect(imported[0].media.map((media) => media.role)).toEqual(['start', 'result']);
    expect(imported[0].media.map((media) => media.id)).toEqual(['media-1', 'media-2']);
    expect(await imported[0].media[0].blob.text()).toBe('image-bytes');
  });

  it('should export a user-friendly Content maps folder structure', async () => {
    const storage = new LineupStorage();
    const point: StoredPoint = {
      id: 'dust2:main:custom:1',
      label: '1',
      mapId: 'dust2',
      levelId: 'main',
      x: 50,
      y: 55,
      kind: 'custom',
      grenadeCategoryId: 'smoke',
      teamSide: 'ct',
      title: 'Window smoke',
      description: 'Aim at the top left of the window frame.',
      requirements: ['jump'],
      trajectory: { vertices: [{ id: 'start', x: 25, y: 30 }] },
      media: [
        {
          id: 'media-1',
          name: 'start.png',
          type: 'image',
          mimeType: 'image/png',
          blob: new Blob(['image-bytes'], { type: 'image/png' }),
          url: 'blob:test',
          role: 'start',
        },
      ],
    };

    const zipBlob = await storage.exportZip([point]);
    const zip = await JSZip.loadAsync(zipBlob);
    const lineupsFile = zip.file('Content/Maps/dust2/Meta/lineups.json');

    expect(zip.file('Content/README.txt')).toBeTruthy();
    expect(zip.file('Content/Maps/dust2/Meta/map.json')).toBeTruthy();
    expect(lineupsFile).toBeTruthy();
    expect(zip.file('Content/Maps/dust2/User/Media/_Pool/start-media-1-start.png')).toBeTruthy();

    const lineups = JSON.parse(await lineupsFile!.async('string'));
    expect(lineups.lineups[0].title).toBe('Window smoke');
    expect(lineups.lineups[0].description).toBe('Aim at the top left of the window frame.');
    expect(lineups.lineups[0].media[0].path).toBe('Content/Maps/dust2/User/Media/_Pool/start-media-1-start.png');
  });

  it('should sanitize media ids in user-friendly media file paths', async () => {
    const storage = new LineupStorage();
    const point: StoredPoint = {
      id: 'cache:main:custom:1780749863944',
      label: '1',
      mapId: 'cache',
      levelId: 'main',
      x: 50,
      y: 55,
      kind: 'custom',
      grenadeCategoryId: 'smoke',
      teamSide: 'ct',
      title: 'Connector Smoke',
      description: '',
      requirements: [],
      trajectory: { vertices: [] },
      media: [
        {
          id: 'cache:main:custom:1780749863944:media:1780750657653:image.png',
          name: 'image.png',
          type: 'image',
          mimeType: 'image/png',
          blob: new Blob(['image-bytes'], { type: 'image/png' }),
          url: 'blob:test',
          role: 'start',
        },
      ],
    };

    const zipBlob = await storage.exportZip([point]);
    const zip = await JSZip.loadAsync(zipBlob);
    const lineupsFile = zip.file('Content/Maps/cache/Meta/lineups.json');
    const lineups = JSON.parse(await lineupsFile!.async('string'));
    const mediaPath = lineups.lineups[0].media[0].path as string;

    expect(mediaPath).toBe(
      'Content/Maps/cache/User/Media/_Pool/start-cache_main_custom_1780749863944_media_1780750657653_image.png-image.png',
    );
    expect(mediaPath.split('/').at(-1)).not.toContain(':');
    expect(zip.file(mediaPath)).toBeTruthy();
  });

  it('should keep result spots separate for different map levels', async () => {
    const storage = new WebLineupStorage();
    const basePoint: StoredPoint = {
      id: 'nuke:l1:custom:1',
      resultSpotId: 'shared-result',
      label: '1',
      mapId: 'nuke',
      levelId: 'l1',
      x: 20,
      y: 30,
      kind: 'custom',
      grenadeCategoryId: 'smoke',
      teamSide: 'ct',
      title: 'L1 smoke',
      description: '',
      requirements: [],
      trajectory: { vertices: [] },
      media: [],
    };

    const spots = (storage as unknown as {
      pointsToResultSpots(points: StoredPoint[]): StoredResultSpotWithLineups[];
    }).pointsToResultSpots([
      basePoint,
      {
        ...basePoint,
        id: 'nuke:l2:custom:1',
        levelId: 'l2',
        title: 'L2 smoke',
      },
    ]);

    expect(spots).toHaveLength(2);
    expect(spots).toMatchObject([
      { levelId: 'l1' },
      { levelId: 'l2' },
    ]);
    expect(spots).toMatchObject([
      { lineups: [expect.objectContaining({ title: 'L1 smoke' })] },
      { lineups: [expect.objectContaining({ title: 'L2 smoke' })] },
    ]);
  });

  it('should export and import custom maps with radar images', async () => {
    const storage = new LineupStorage();
    const map: StoredMap = {
      id: 'workshop-map',
      name: 'Workshop Map',
      location: 'Custom',
      tags: ['Custom'],
      levelId: 'main',
      levelName: 'Main',
      levelDescription: 'Custom radar image.',
      imageName: 'radar.png',
      imageMimeType: 'image/png',
      imageBlob: new Blob(['radar-bytes'], { type: 'image/png' }),
      imageUrl: 'blob:radar',
    };

    const zipBlob = await storage.exportZip([], [map]);
    const zip = await JSZip.loadAsync(zipBlob);

    expect(zip.file('Content/Maps/workshop-map/Meta/map.json')).toBeTruthy();
    expect(zip.file('Content/Maps/workshop-map/Meta/radar.png')).toBeTruthy();

    const imported = await storage.importZipData(new File([zipBlob], 'lineups.zip', { type: 'application/zip' }));
    expect(imported.maps).toHaveLength(1);
    expect(imported.maps[0].name).toBe('Workshop Map');
    expect(await imported.maps[0].imageBlob.text()).toBe('radar-bytes');
  });
});
