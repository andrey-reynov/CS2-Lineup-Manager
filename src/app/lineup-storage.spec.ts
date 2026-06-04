import { LineupStorage, StoredPoint } from './lineup-storage';

describe('LineupStorage', () => {
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
    expect(imported[0].teamSide).toBe('ct');
    expect(imported[0].heroMediaId).toBe('media-2');
    expect(imported[0].trajectory?.vertices.map((vertex) => vertex.id)).toEqual(['vertex-1', 'vertex-2']);
    expect(imported[0].media.map((media) => media.role)).toEqual(['start', 'result']);
    expect(imported[0].media.map((media) => media.id)).toEqual(['media-1', 'media-2']);
    expect(await imported[0].media[0].blob.text()).toBe('image-bytes');
  });
});
