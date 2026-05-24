import { Component, computed, signal } from '@angular/core';

type MapZone = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tone: 'sand' | 'stone' | 'water' | 'green' | 'red';
};

type MapLevel = {
  id: string;
  name: string;
  description: string;
  zones: MapZone[];
};

type TacticalMap = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  levels: MapLevel[];
};

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
        zones: [
          { label: 'A Long', x: 64, y: 58, width: 176, height: 70, tone: 'sand' },
          { label: 'A Site', x: 274, y: 48, width: 132, height: 104, tone: 'stone' },
          { label: 'Mid', x: 196, y: 180, width: 154, height: 90, tone: 'sand' },
          { label: 'B Tunnels', x: 42, y: 300, width: 190, height: 82, tone: 'red' },
          { label: 'B Site', x: 280, y: 314, width: 126, height: 96, tone: 'stone' },
        ],
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
        zones: [
          { label: 'A Site', x: 58, y: 64, width: 146, height: 112, tone: 'sand' },
          { label: 'Palace', x: 228, y: 44, width: 118, height: 72, tone: 'stone' },
          { label: 'Mid', x: 170, y: 190, width: 156, height: 86, tone: 'green' },
          { label: 'Connector', x: 66, y: 214, width: 86, height: 102, tone: 'stone' },
          { label: 'B Apps', x: 260, y: 318, width: 138, height: 82, tone: 'red' },
          { label: 'B Site', x: 96, y: 342, width: 126, height: 78, tone: 'sand' },
        ],
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
        zones: [
          { label: 'A Site', x: 74, y: 52, width: 132, height: 98, tone: 'stone' },
          { label: 'Apps', x: 244, y: 42, width: 122, height: 82, tone: 'red' },
          { label: 'Mid', x: 146, y: 184, width: 122, height: 92, tone: 'sand' },
          { label: 'Banana', x: 260, y: 238, width: 108, height: 150, tone: 'green' },
          { label: 'B Site', x: 92, y: 338, width: 132, height: 82, tone: 'stone' },
        ],
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
        zones: [
          { label: 'Yard', x: 42, y: 58, width: 138, height: 150, tone: 'green' },
          { label: 'Heaven', x: 210, y: 46, width: 108, height: 76, tone: 'stone' },
          { label: 'A Site', x: 190, y: 154, width: 156, height: 122, tone: 'red' },
          { label: 'Hut', x: 58, y: 258, width: 116, height: 86, tone: 'stone' },
          { label: 'Squeaky', x: 256, y: 318, width: 120, height: 78, tone: 'sand' },
        ],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Ramp, Secret, Control и нижний плент B.',
        zones: [
          { label: 'Secret', x: 54, y: 72, width: 126, height: 138, tone: 'water' },
          { label: 'Ramp', x: 218, y: 64, width: 122, height: 96, tone: 'stone' },
          { label: 'Control', x: 70, y: 258, width: 116, height: 88, tone: 'red' },
          { label: 'B Site', x: 210, y: 226, width: 154, height: 130, tone: 'sand' },
          { label: 'Decon', x: 286, y: 372, width: 88, height: 54, tone: 'green' },
        ],
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
        zones: [
          { label: 'A Site', x: 62, y: 62, width: 126, height: 102, tone: 'green' },
          { label: 'Donut', x: 214, y: 94, width: 96, height: 82, tone: 'stone' },
          { label: 'Mid', x: 158, y: 214, width: 138, height: 82, tone: 'sand' },
          { label: 'Cave', x: 52, y: 324, width: 112, height: 76, tone: 'red' },
          { label: 'B Site', x: 224, y: 324, width: 138, height: 84, tone: 'green' },
        ],
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
        zones: [
          { label: 'A Site', x: 62, y: 74, width: 132, height: 90, tone: 'sand' },
          { label: 'Bridge', x: 218, y: 92, width: 126, height: 70, tone: 'stone' },
          { label: 'Mid', x: 146, y: 210, width: 128, height: 86, tone: 'water' },
          { label: 'Canal', x: 54, y: 314, width: 138, height: 86, tone: 'water' },
          { label: 'B Site', x: 238, y: 322, width: 128, height: 86, tone: 'sand' },
        ],
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
        zones: [
          { label: 'A Ramp', x: 52, y: 78, width: 130, height: 142, tone: 'red' },
          { label: 'A Site', x: 214, y: 70, width: 136, height: 96, tone: 'stone' },
          { label: 'Mid', x: 148, y: 238, width: 130, height: 78, tone: 'sand' },
          { label: 'B Site', x: 248, y: 342, width: 126, height: 76, tone: 'green' },
        ],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Лестницы, нижняя рампа и переходы под точками.',
        zones: [
          { label: 'Lower Ramp', x: 66, y: 72, width: 142, height: 106, tone: 'stone' },
          { label: 'Stairs', x: 232, y: 110, width: 98, height: 92, tone: 'red' },
          { label: 'Under Mid', x: 132, y: 244, width: 166, height: 82, tone: 'sand' },
          { label: 'B Lower', x: 242, y: 348, width: 110, height: 70, tone: 'green' },
        ],
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
        zones: [
          { label: 'A Long', x: 62, y: 52, width: 130, height: 98, tone: 'green' },
          { label: 'Toilets', x: 226, y: 66, width: 116, height: 86, tone: 'stone' },
          { label: 'Connector', x: 156, y: 204, width: 110, height: 86, tone: 'sand' },
          { label: 'Water', x: 54, y: 314, width: 134, height: 86, tone: 'water' },
          { label: 'B Site', x: 236, y: 318, width: 126, height: 88, tone: 'red' },
        ],
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
  protected readonly selectedMapId = signal(DEFAULT_MAPS[0].id);
  protected readonly selectedLevelId = signal(DEFAULT_MAPS[0].levels[0].id);

  protected readonly selectedMap = computed(() => {
    return this.maps.find((map) => map.id === this.selectedMapId()) ?? this.maps[0];
  });

  protected readonly selectedLevel = computed(() => {
    const map = this.selectedMap();
    return map.levels.find((level) => level.id === this.selectedLevelId()) ?? map.levels[0];
  });

  protected selectMap(map: TacticalMap): void {
    this.selectedMapId.set(map.id);
    this.selectedLevelId.set(map.levels[0].id);
  }

  protected selectLevel(level: MapLevel): void {
    this.selectedLevelId.set(level.id);
  }
}
