import { LineupStorage, StoredMap, StoredPoint } from './lineup-storage';
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
    expect(zip.file('Content/Maps/dust2/User/Media/Window smoke/start-media-1-start.png')).toBeTruthy();

    const lineups = JSON.parse(await lineupsFile!.async('string'));
    expect(lineups.lineups[0].title).toBe('Window smoke');
    expect(lineups.lineups[0].description).toBe('Aim at the top left of the window frame.');
    expect(lineups.lineups[0].media[0].path).toBe('Content/Maps/dust2/User/Media/Window smoke/start-media-1-start.png');
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
