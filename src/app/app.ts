import { Component, HostListener, computed, signal } from '@angular/core';
import {
  GrenadeCategoryId,
  LineupStorage,
  StoredMedia,
  StoredPoint,
  TeamSide,
} from './lineup-storage';

type MapPoint = {
  id: string;
  label: string;
  mapId: string;
  levelId: string;
  x: number;
  y: number;
  kind: 'spawn' | 'bomb' | 'lineup' | 'custom';
  grenadeCategoryId?: GrenadeCategoryId;
  teamSide: TeamSide;
  title?: string;
  requirements?: string[];
  media?: PointMedia[];
};

type PointMedia = StoredMedia;

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
  id: GrenadeCategoryId;
  label: string;
  iconUrl?: string;
};

type TeamSideOption = {
  id: TeamSide;
  label: string;
  iconUrl: string;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  hasMoved: boolean;
};

type RequirementOption = {
  id: string;
  label: string;
};

type PointActionMenu = {
  pointId: string;
  x: number;
  y: number;
};

type AppView = 'home' | 'map' | 'settings';

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

const MOVEMENT_REQUIREMENTS: RequirementOption[] = [
  { id: 'crouch', label: 'Crouch' },
  { id: 'jump', label: 'Jump' },
  { id: 'run', label: 'Run' },
];

const MOUSE_REQUIREMENTS: RequirementOption[] = [
  { id: 'left-click', label: 'Left click' },
  { id: 'right-click', label: 'Right click' },
];

const TEAM_SIDE_OPTIONS: TeamSideOption[] = [
  {
    id: 'ct',
    label: 'CT',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/defuser.svg',
  },
  {
    id: 't',
    label: 'T',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/c4.svg',
  },
];

const POINT_ACTION_MENU_WIDTH = 200;
const POINT_ACTION_MENU_HEIGHT = 216;
const POINT_ACTION_MENU_GAP = 10;
const POINT_ACTION_MENU_EDGE_PADDING = 8;

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
  protected readonly teamSideOptions = TEAM_SIDE_OPTIONS;
  protected readonly movementRequirements = MOVEMENT_REQUIREMENTS;
  protected readonly mouseRequirements = MOUSE_REQUIREMENTS;
  protected readonly appView = signal<AppView>('home');
  protected readonly selectedMapId = signal<string | null>(null);
  protected readonly selectedLevelId = signal(DEFAULT_MAPS[0].levels[0].id);
  protected readonly selectedGrenadeCategoryId = signal(GRENADE_CATEGORIES[0].id);
  protected readonly selectedTeamSide = signal<TeamSide>('ct');
  protected readonly addedPoints = signal<Record<string, MapPoint[]>>({});
  protected readonly draftPoint = signal<MapPoint | null>(null);
  protected readonly markerCounters = signal<Record<string, number>>({});
  protected readonly mapZoom = signal(1);
  protected readonly mapPan = signal({ x: 0, y: 0 });
  protected readonly selectedPointId = signal<string | null>(null);
  protected readonly pointActionMenu = signal<PointActionMenu | null>(null);
  protected readonly previewMedia = signal<PointMedia | null>(null);
  protected readonly importError = signal<string | null>(null);

  private readonly storage = new LineupStorage();
  private dragState: DragState | null = null;
  private suppressNextBoardClick = false;

  protected readonly selectedMap = computed(() => {
    return this.maps.find((map) => map.id === this.selectedMapId());
  });

  protected readonly selectedLevel = computed(() => {
    const map = this.selectedMap();
    return map?.levels.find((level) => level.id === this.selectedLevelId()) ?? map?.levels[0];
  });

  protected readonly currentPoints = computed(() => {
    const selectedGrenadeCategoryId = this.selectedGrenadeCategoryId();
    const selectedTeamSide = this.selectedTeamSide();
    const selectedMap = this.selectedMap();
    const selectedLevel = this.selectedLevel();
    if (!selectedMap || !selectedLevel) {
      return [];
    }

    return [
      ...this.selectedLevel()!.points,
      ...(this.addedPoints()[this.currentLevelKey()] ?? []),
      ...(this.draftPoint() ? [this.draftPoint()!] : []),
    ].filter((point) => (
      !point.grenadeCategoryId ||
      (point.grenadeCategoryId === selectedGrenadeCategoryId && point.teamSide === selectedTeamSide)
    ));
  });

  protected readonly selectedPoint = computed(() => {
    const selectedPointId = this.selectedPointId();
    if (!selectedPointId) {
      return undefined;
    }

    return (this.addedPoints()[this.currentLevelKey()] ?? []).find((point) => point.id === selectedPointId);
  });

  protected readonly allSavedPoints = computed(() => {
    return Object.values(this.addedPoints()).flat();
  });

  constructor() {
    void this.loadStoredPoints();
  }

  protected selectMap(map: TacticalMap): void {
    this.appView.set('map');
    this.selectedMapId.set(map.id);
    this.selectedLevelId.set(map.levels[0].id);
    this.resetMapView();
    this.closePointEditor();
    this.draftPoint.set(null);
  }

  protected selectHome(): void {
    this.appView.set('home');
    this.selectedMapId.set(null);
    this.closePointEditor();
    this.draftPoint.set(null);
  }

  protected selectSettings(): void {
    this.appView.set('settings');
    this.selectedMapId.set(null);
    this.closePointEditor();
    this.draftPoint.set(null);
  }

  protected selectLevel(level: MapLevel): void {
    this.selectedLevelId.set(level.id);
    this.resetMapView();
    this.closePointEditor();
    this.draftPoint.set(null);
  }

  protected selectGrenadeCategory(category: GrenadeCategory): void {
    this.selectedGrenadeCategoryId.set(category.id);
    this.closePointEditor();
  }

  protected selectTeamSide(teamSide: TeamSide): void {
    this.selectedTeamSide.set(teamSide);
    this.closePointEditor();
  }

  protected updateSelectedPointTeamSide(teamSide: TeamSide): void {
    this.updateSelectedPoint({ teamSide });
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
    if (!this.selectedMap() || !this.selectedLevel()) {
      return;
    }

    if ((event.target as HTMLElement).closest('button')) {
      return;
    }

    if (this.suppressNextBoardClick) {
      this.suppressNextBoardClick = false;
      return;
    }

    this.closePointActionMenu();
    this.addPointFromBoardEvent(event, event.currentTarget as HTMLElement);
  }

  protected onBoardWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomAt(event.currentTarget as HTMLElement, event.clientX, event.clientY, event.deltaY < 0 ? 0.15 : -0.15);
  }

  protected zoomIn(event: MouseEvent): void {
    event.stopPropagation();
    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (board) {
      const rect = board.getBoundingClientRect();
      this.zoomAt(board, rect.left + rect.width / 2, rect.top + rect.height / 2, 0.25);
    }
  }

  protected zoomOut(event: MouseEvent): void {
    event.stopPropagation();
    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (board) {
      const rect = board.getBoundingClientRect();
      this.zoomAt(board, rect.left + rect.width / 2, rect.top + rect.height / 2, -0.25);
    }
  }

  protected openPointEditor(point: MapPoint, event: MouseEvent): void {
    event.stopPropagation();
    if (point.grenadeCategoryId) {
      this.selectedPointId.set(point.id);
      this.closePointActionMenu();
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    const position = this.getPointActionMenuPosition(event.clientX - rect.left, event.clientY - rect.top, rect);
    this.selectedPointId.set(null);
    this.pointActionMenu.set({
      pointId: point.id,
      x: position.x,
      y: position.y,
    });
  }

  protected closePointEditor(): void {
    this.selectedPointId.set(null);
    this.closePointActionMenu();
    this.previewMedia.set(null);
  }

  protected closePointActionMenu(): void {
    this.pointActionMenu.set(null);
  }

  protected deleteMarker(pointId: string, event: MouseEvent): void {
    event.stopPropagation();
    const key = this.currentLevelKey();
    this.addedPoints.update((points) => ({
      ...points,
      [key]: (points[key] ?? []).filter((point) => point.id !== pointId),
    }));
    void this.storage.deletePoint(pointId);
    this.closePointEditor();
  }

  protected updateSelectedPointTitle(value: string): void {
    this.updateSelectedPoint({ title: value });
  }

  protected toggleRequirement(requirementId: string, checked: boolean): void {
    const point = this.selectedPoint();
    const current = point?.requirements ?? [];
    const requirements = checked
      ? Array.from(new Set([...current, requirementId]))
      : current.filter((id) => id !== requirementId);

    this.updateSelectedPoint({ requirements });
  }

  protected hasRequirement(point: MapPoint, requirementId: string): boolean {
    return (point.requirements ?? []).includes(requirementId);
  }

  protected onMediaFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addMediaFiles(input.files);
    }
    input.value = '';
  }

  protected openMediaPreview(media: PointMedia): void {
    this.previewMedia.set(media);
  }

  protected closeMediaPreview(): void {
    this.previewMedia.set(null);
  }

  protected saveSelectedPoint(): void {
    const point = this.selectedPoint();
    if (point?.grenadeCategoryId) {
      void this.storage.savePoint(this.toStoredPoint(point));
    }
    this.closePointEditor();
  }

  protected assignGrenadeToPoint(pointId: string, category: GrenadeCategory, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedGrenadeCategoryId.set(category.id);
    this.updatePointById(pointId, {
      grenadeCategoryId: category.id,
      teamSide: this.selectedTeamSide(),
    });
    this.selectedPointId.set(pointId);
    this.draftPoint.set(null);
    this.closePointActionMenu();
    const point = this.selectedPoint();
    if (point?.grenadeCategoryId) {
      void this.storage.savePoint(this.toStoredPoint(point));
    }
  }

  protected addStartPoint(pointId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.closePointActionMenu();
  }

  protected async exportZip(): Promise<void> {
    const blob = await this.storage.exportZip(this.allSavedPoints().map((point) => this.toStoredPoint(point)));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cs2-nades-${new Date().toISOString().slice(0, 10)}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected async importZip(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    try {
      const points = await this.storage.importZip(file);
      await this.storage.replaceAll(points);
      this.applyStoredPoints(points);
      this.importError.set(null);
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'Import failed');
    }
  }

  @HostListener('window:paste', ['$event'])
  protected onPaste(event: ClipboardEvent): void {
    if (!this.selectedPoint()) {
      return;
    }

    const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    this.addMediaFiles(files);
  }

  private addPointFromBoardEvent(event: MouseEvent, board: HTMLElement): void {
    const selectedMap = this.selectedMap();
    const selectedLevel = this.selectedLevel();
    if (!selectedMap || !selectedLevel) {
      return;
    }

    const { x, y } = this.getMapPercentFromClientPoint(event.clientX, event.clientY, board);
    const key = this.currentLevelKey();
    const nextPointNumber = (this.markerCounters()[key] ?? 0) + 1;
    const point: MapPoint = {
      id: `${key}:custom:${Date.now()}`,
      label: String(nextPointNumber),
      mapId: selectedMap.id,
      levelId: selectedLevel.id,
      x,
      y,
      kind: 'custom',
      teamSide: this.selectedTeamSide(),
      title: '',
      requirements: [],
      media: [],
    };

    this.markerCounters.update((counters) => ({
      ...counters,
      [key]: nextPointNumber,
    }));
    this.draftPoint.set(point);
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

  private addMediaFiles(files: FileList | File[]): void {
    const point = this.selectedPoint();
    if (!point) {
      return;
    }

    const media = Array.from(files)
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
      .map((file) => ({
        id: `${point.id}:media:${Date.now()}:${file.name}`,
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
        mimeType: file.type,
        blob: file,
        url: URL.createObjectURL(file),
      }));

    if (media.length === 0) {
      return;
    }

    this.updateSelectedPoint({
      media: [...(point.media ?? []), ...media],
    });
  }

  private updateSelectedPoint(patch: Partial<MapPoint>): void {
    const selectedPointId = this.selectedPointId();
    if (!selectedPointId) {
      return;
    }

    const key = this.currentLevelKey();
    this.updatePointInLevel(key, selectedPointId, patch);
  }

  private updatePointById(pointId: string, patch: Partial<MapPoint>): void {
    const draftPoint = this.draftPoint();
    if (draftPoint?.id === pointId) {
      const nextPoint = { ...draftPoint, ...patch };
      this.addedPoints.update((points) => ({
        ...points,
        [this.currentLevelKey()]: [...(points[this.currentLevelKey()] ?? []), nextPoint],
      }));
      return;
    }

    this.updatePointInLevel(this.currentLevelKey(), pointId, patch);
  }

  private updatePointInLevel(key: string, pointId: string, patch: Partial<MapPoint>): void {
    this.addedPoints.update((points) => ({
      ...points,
      [key]: (points[key] ?? []).map((point) => (
        point.id === pointId ? { ...point, ...patch } : point
      )),
    }));
  }

  private async loadStoredPoints(): Promise<void> {
    const points = await this.storage.loadPoints();
    this.applyStoredPoints(points);
  }

  private applyStoredPoints(points: StoredPoint[]): void {
    const groupedPoints: Record<string, MapPoint[]> = {};
    const counters: Record<string, number> = {};
    for (const point of points) {
      const key = `${point.mapId}:${point.levelId}`;
      groupedPoints[key] = [...(groupedPoints[key] ?? []), this.fromStoredPoint(point)];
      const numericLabel = Number(point.label);
      counters[key] = Math.max(counters[key] ?? 0, Number.isFinite(numericLabel) ? numericLabel : 0);
    }

    this.addedPoints.set(groupedPoints);
    this.markerCounters.set(counters);
    this.draftPoint.set(null);
    this.closePointEditor();
  }

  private fromStoredPoint(point: StoredPoint): MapPoint {
    return {
      id: point.id,
      label: point.label,
      mapId: point.mapId,
      levelId: point.levelId,
      x: point.x,
      y: point.y,
      kind: point.kind,
      grenadeCategoryId: point.grenadeCategoryId,
      teamSide: point.teamSide,
      title: point.title,
      requirements: point.requirements,
      media: point.media,
    };
  }

  private toStoredPoint(point: MapPoint): StoredPoint {
    if (!point.grenadeCategoryId) {
      throw new Error('Draft point cannot be stored');
    }

    return {
      id: point.id,
      label: point.label,
      mapId: point.mapId,
      levelId: point.levelId,
      x: point.x,
      y: point.y,
      kind: 'custom',
      grenadeCategoryId: point.grenadeCategoryId,
      teamSide: point.teamSide,
      title: point.title ?? '',
      requirements: point.requirements ?? [],
      media: point.media ?? [],
    };
  }

  private getMapPercentFromClientPoint(clientX: number, clientY: number, board: HTMLElement): Pick<MapPoint, 'x' | 'y'> {
    const rect = board.getBoundingClientRect();
    const pan = this.mapPan();
    const zoom = this.mapZoom();
    const x = this.toPercent((clientX - rect.left - pan.x) / zoom, rect.width);
    const y = this.toPercent((clientY - rect.top - pan.y) / zoom, rect.height);

    return { x, y };
  }

  private getPointActionMenuPosition(x: number, y: number, boardRect: DOMRect): Pick<PointActionMenu, 'x' | 'y'> {
    const opensRight = x + POINT_ACTION_MENU_GAP + POINT_ACTION_MENU_WIDTH <= boardRect.width;
    const opensDown = y + POINT_ACTION_MENU_GAP + POINT_ACTION_MENU_HEIGHT <= boardRect.height;
    const nextX = opensRight ? x + POINT_ACTION_MENU_GAP : x - POINT_ACTION_MENU_WIDTH - POINT_ACTION_MENU_GAP;
    const nextY = opensDown ? y + POINT_ACTION_MENU_GAP : y - POINT_ACTION_MENU_HEIGHT - POINT_ACTION_MENU_GAP;

    return {
      x: this.clamp(nextX, POINT_ACTION_MENU_EDGE_PADDING, boardRect.width - POINT_ACTION_MENU_WIDTH - POINT_ACTION_MENU_EDGE_PADDING),
      y: this.clamp(nextY, POINT_ACTION_MENU_EDGE_PADDING, boardRect.height - POINT_ACTION_MENU_HEIGHT - POINT_ACTION_MENU_EDGE_PADDING),
    };
  }

  private currentLevelKey(): string {
    return `${this.selectedMap()?.id ?? 'none'}:${this.selectedLevel()?.id ?? 'none'}`;
  }

  private toPercent(value: number, size: number): number {
    if (size <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (value / size) * 100));
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }

    return Math.max(min, Math.min(max, value));
  }
}
