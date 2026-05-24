import { Component, computed, signal } from '@angular/core';

type MapPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: 'spawn' | 'bomb' | 'lineup' | 'custom';
  grenadeCategoryId?: string;
};

type MapLevel = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  points: MapPoint[];
};

type TacticalMap = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  levels: MapLevel[];
};

type GrenadeCategory = {
  id: string;
  label: string;
  iconUrl?: string;
};

type MarkerMenu = {
  pointId: string;
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  hasMoved: boolean;
};

const GRENADE_CATEGORIES: GrenadeCategory[] = [
  {
    id: 'smoke',
    label: 'Smoke',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/smokegrenade.svg',
  },
  {
    id: 'flash',
    label: 'Flash',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/flashbang.svg',
  },
  {
    id: 'molotov',
    label: 'Molotov',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/molotov.svg',
  },
  {
    id: 'he',
    label: 'HE',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/hegrenade.svg',
  },
];

const DEFAULT_MAPS: TacticalMap[] = [
  {
    id: 'dust2',
    name: 'Dust2',
    location: 'Morocco',
    tags: ['Active Duty', 'Classic'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'A Long, Mid, B Tunnels и плент B на одной схеме.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_dust2_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'mirage',
    name: 'Mirage',
    location: 'Morocco',
    tags: ['Active Duty', 'Mid Control'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'A Site, Mid, Connector и B Apps для быстрых смоков.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_mirage_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'inferno',
    name: 'Inferno',
    location: 'Italy',
    tags: ['Active Duty', 'Utility Heavy'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Banana, Mid и Apartments как базовые зоны для гранат.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_inferno_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'nuke',
    name: 'Nuke',
    location: 'United States',
    tags: ['Multi Level', 'Indoor'],
    levels: [
      {
        id: 'upper',
        name: 'Верхний уровень',
        description: 'Yard, Heaven, Hut и верхний плент A.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_nuke_radar_psd.png',
        points: [],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Ramp, Secret, Control и нижний плент B.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_nuke_lower_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'ancient',
    name: 'Ancient',
    location: 'Mexico',
    tags: ['Active Duty', 'Temple'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Donut, Mid и обе точки с зелеными проходами.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_ancient_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'anubis',
    name: 'Anubis',
    location: 'Egypt',
    tags: ['Active Duty', 'Canals'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Canal, Mid, Bridge и оба плента.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_anubis_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'vertigo',
    name: 'Vertigo',
    location: 'United States',
    tags: ['Multi Level', 'Vertical'],
    levels: [
      {
        id: 'upper',
        name: 'Верхний уровень',
        description: 'A Ramp, Mid и верхний B.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_vertigo_radar_psd.png',
        points: [],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Лестницы, нижняя рампа и переходы под точками.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_vertigo_lower_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'overpass',
    name: 'Overpass',
    location: 'Germany',
    tags: ['Reserve', 'Long Rotations'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Long, Toilets, Connector и B Water.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_overpass_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'cache',
    name: 'Cache',
    location: 'Ukraine',
    tags: ['Reserve', 'Classic'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'A Main, Mid, B Main и оба плента.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_cache_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'train',
    name: 'Train',
    location: 'Russia',
    tags: ['Reserve', 'Multi Level'],
    levels: [
      {
        id: 'upper',
        name: 'Верхний уровень',
        description: 'Верхняя схема Train с внешним и внутренним плентом.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_train_radar_psd.png',
        points: [],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Нижний уровень Train для переходов и подземных позиций.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_train_lower_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'italy',
    name: 'Italy',
    location: 'Italy',
    tags: ['Hostage', 'Classic'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Hostage-карта Italy из локальных CS2 ассетов.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/cs_italy_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'office',
    name: 'Office',
    location: 'United States',
    tags: ['Hostage', 'Classic'],
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Hostage-карта Office из локальных CS2 ассетов.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/cs_office_radar_psd.png',
        points: [],
      },
    ],
  },
];

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly maps = DEFAULT_MAPS;
  protected readonly grenadeCategories = GRENADE_CATEGORIES;
  protected readonly selectedMapId = signal(DEFAULT_MAPS[0].id);
  protected readonly selectedLevelId = signal(DEFAULT_MAPS[0].levels[0].id);
  protected readonly selectedGrenadeCategoryId = signal(GRENADE_CATEGORIES[0].id);
  protected readonly addedPoints = signal<Record<string, MapPoint[]>>({});
  protected readonly markerCounters = signal<Record<string, number>>({});
  protected readonly mapZoom = signal(1);
  protected readonly mapPan = signal({ x: 0, y: 0 });
  protected readonly markerMenu = signal<MarkerMenu | null>(null);

  private dragState: DragState | null = null;
  private justCreatedPointId: string | null = null;
  private suppressNextBoardClick = false;

  protected readonly selectedMap = computed(() => {
    return this.maps.find((map) => map.id === this.selectedMapId()) ?? this.maps[0];
  });

  protected readonly selectedLevel = computed(() => {
    const map = this.selectedMap();
    return map.levels.find((level) => level.id === this.selectedLevelId()) ?? map.levels[0];
  });

  protected readonly currentPoints = computed(() => {
    const selectedGrenadeCategoryId = this.selectedGrenadeCategoryId();
    return [
      ...this.selectedLevel().points,
      ...(this.addedPoints()[this.currentLevelKey()] ?? []),
    ].filter((point) => point.grenadeCategoryId === selectedGrenadeCategoryId);
  });

  protected selectMap(map: TacticalMap): void {
    this.selectedMapId.set(map.id);
    this.selectedLevelId.set(map.levels[0].id);
    this.resetMapView();
    this.closeMarkerMenu();
  }

  protected selectLevel(level: MapLevel): void {
    this.selectedLevelId.set(level.id);
    this.resetMapView();
    this.closeMarkerMenu();
  }

  protected selectGrenadeCategory(category: GrenadeCategory): void {
    this.selectedGrenadeCategoryId.set(category.id);
  }

  protected grenadeCategoryForPoint(point: MapPoint): GrenadeCategory | undefined {
    return this.grenadeCategories.find((category) => category.id === point.grenadeCategoryId);
  }

  protected onBoardPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }

    const board = event.currentTarget as HTMLElement;
    board.setPointerCapture(event.pointerId);
    this.closeMarkerMenu();
    this.dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: this.mapPan().x,
      startPanY: this.mapPan().y,
      hasMoved: false,
    };
  }

  protected onBoardPointerMove(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId || this.mapZoom() <= 1) {
      return;
    }

    const dx = event.clientX - this.dragState.startClientX;
    const dy = event.clientY - this.dragState.startClientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.dragState.hasMoved = true;
    }

    this.mapPan.set({
      x: this.dragState.startPanX + dx,
      y: this.dragState.startPanY + dy,
    });
  }

  protected onBoardPointerUp(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    const board = event.currentTarget as HTMLElement;
    board.releasePointerCapture(event.pointerId);
    this.suppressNextBoardClick = this.dragState.hasMoved;
    this.dragState = null;
  }

  protected onBoardClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }

    if (this.suppressNextBoardClick) {
      this.suppressNextBoardClick = false;
      return;
    }

    this.addPointFromBoardEvent(event, event.currentTarget as HTMLElement);
  }

  protected onBoardWheel(event: WheelEvent): void {
    event.preventDefault();
    this.closeMarkerMenu();
    this.zoomAt(event.currentTarget as HTMLElement, event.clientX, event.clientY, event.deltaY < 0 ? 0.15 : -0.15);
  }

  protected zoomIn(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMarkerMenu();
    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (board) {
      const rect = board.getBoundingClientRect();
      this.zoomAt(board, rect.left + rect.width / 2, rect.top + rect.height / 2, 0.25);
    }
  }

  protected zoomOut(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMarkerMenu();
    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (board) {
      const rect = board.getBoundingClientRect();
      this.zoomAt(board, rect.left + rect.width / 2, rect.top + rect.height / 2, -0.25);
    }
  }

  protected openMarkerMenu(point: MapPoint, event: MouseEvent): void {
    event.stopPropagation();
    if (this.justCreatedPointId === point.id) {
      this.justCreatedPointId = null;
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    this.markerMenu.set({
      pointId: point.id,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  protected closeMarkerMenu(): void {
    this.markerMenu.set(null);
  }

  protected deleteMarker(pointId: string, event: MouseEvent): void {
    event.stopPropagation();
    const key = this.currentLevelKey();
    this.addedPoints.update((points) => ({
      ...points,
      [key]: (points[key] ?? []).filter((point) => point.id !== pointId),
    }));
    this.closeMarkerMenu();
  }

  protected noop(event: MouseEvent): void {
    event.stopPropagation();
  }

  private addPointFromBoardEvent(event: MouseEvent, board: HTMLElement): void {
    const { x, y } = this.getMapPercentFromClientPoint(event.clientX, event.clientY, board);
    const key = this.currentLevelKey();
    const nextPointNumber = (this.markerCounters()[key] ?? 0) + 1;
    const grenadeCategoryId = this.selectedGrenadeCategoryId();
    const point: MapPoint = {
      id: `${key}:custom:${Date.now()}`,
      label: String(nextPointNumber),
      x,
      y,
      kind: 'custom',
      grenadeCategoryId,
    };

    this.justCreatedPointId = point.id;
    this.markerCounters.update((counters) => ({
      ...counters,
      [key]: nextPointNumber,
    }));
    this.addedPoints.update((points) => ({
      ...points,
      [key]: [...(points[key] ?? []), point],
    }));
  }

  private zoomAt(board: HTMLElement, clientX: number, clientY: number, delta: number): void {
    const oldZoom = this.mapZoom();
    const zoom = Math.max(1, Math.min(4, oldZoom + delta));
    if (zoom === oldZoom) {
      return;
    }

    const rect = board.getBoundingClientRect();
    const pan = this.mapPan();
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;
    const mapX = (cursorX - pan.x) / oldZoom;
    const mapY = (cursorY - pan.y) / oldZoom;

    this.mapZoom.set(zoom);

    if (zoom === 1) {
      this.mapPan.set({ x: 0, y: 0 });
      return;
    }

    this.mapPan.set({
      x: cursorX - mapX * zoom,
      y: cursorY - mapY * zoom,
    });
  }

  private resetMapView(): void {
    this.mapZoom.set(1);
    this.mapPan.set({ x: 0, y: 0 });
  }

  private getMapPercentFromClientPoint(clientX: number, clientY: number, board: HTMLElement): Pick<MapPoint, 'x' | 'y'> {
    const rect = board.getBoundingClientRect();
    const pan = this.mapPan();
    const zoom = this.mapZoom();
    const x = this.toPercent((clientX - rect.left - pan.x) / zoom, rect.width);
    const y = this.toPercent((clientY - rect.top - pan.y) / zoom, rect.height);

    return { x, y };
  }

  private currentLevelKey(): string {
    return `${this.selectedMap().id}:${this.selectedLevel().id}`;
  }

  private toPercent(value: number, size: number): number {
    if (size <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (value / size) * 100));
  }
}
