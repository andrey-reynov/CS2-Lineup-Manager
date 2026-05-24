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
      media: [
        {
          id: 'media-1',
          name: 'lineup.png',
          type: 'image',
          mimeType: 'image/png',
          blob: new Blob(['image-bytes'], { type: 'image/png' }),
          url: 'blob:test',
        },
      ],
    };

    const zipBlob = await storage.exportZip([point]);
    const imported = await storage.importZip(new File([zipBlob], 'lineups.zip', { type: 'application/zip' }));

    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe('Window smoke');
    expect(imported[0].teamSide).toBe('ct');
    expect(imported[0].media).toHaveLength(1);
    expect(await imported[0].media[0].blob.text()).toBe('image-bytes');
  });
});
