import * as THREE from 'three';
import { Builder } from './Builder';
import { LightGroup } from './LightGroup';
import { Sound } from '../core/Sound';

/**
 * Plan de l'appartement (mètres). Repère : X = est, Z = sud, Y = haut.
 * Reconstruit à partir des photos :
 *  - studio « chambre-séjour » : tête de lit au nord, baie vitrée coulissante à l'est
 *    donnant sur le jardin, armoire à l'ouest, TV murale à l'est ;
 *  - au sud : kitchenette en alcôve (entre l'entrée et la salle de bain) ;
 *  - salle de bain au sud-est (porte depuis le séjour) ;
 *  - jardin privatif à l'est : gazon synthétique, murs végétaux, store banne, spa.
 * Les zones non photographiées (entrée, au-delà des murs) sont complétées de façon plausible.
 */
export const H = 2.7; // hauteur sous plafond
export const T = 0.12; // épaisseur des cloisons
export const ROOM = { x0: 0, x1: 3.6, z0: 0, z1: 4.4 };
export const SLIDER = { z0: 0.55, z1: 2.55, h: 2.25 };
export const KITCHEN = { x0: 1.12, x1: 2.5, z0: 4.4, z1: 5.1 };
export const HALL = { x0: 0, x1: 1.0, z0: 4.4, z1: 6.2 };
export const BATH = { x0: 2.62, x1: 4.9, z0: 4.52, z1: 6.6 };
export const BATH_DOOR = { x0: 2.72, x1: 3.47, h: 2.08 };
export const GARDEN = { x0: 3.72, x1: 10.2, z0: -1.4, z1: 4.4 };
export const JACUZZI = { x: 9.05, z: -0.2, r: 0.95 };

export interface Zone {
  name: string;
  x0: number; x1: number; z0: number; z1: number;
  outdoor?: boolean;
}

/** Zones nommées affichées à l'entrée du joueur (testées dans l'ordre). */
export const ZONES: Zone[] = [
  { name: 'Salle de bain', x0: BATH.x0, x1: BATH.x1, z0: BATH.z0 - 0.06, z1: BATH.z1 },
  { name: 'Entrée', x0: HALL.x0, x1: HALL.x1, z0: HALL.z0 + 0.15, z1: HALL.z1 },
  { name: 'Kitchenette', x0: KITCHEN.x0, x1: KITCHEN.x1, z0: 4.05, z1: KITCHEN.z1 },
  { name: 'Chambre · Séjour', x0: ROOM.x0, x1: ROOM.x1 + 0.12, z0: ROOM.z0, z1: ROOM.z1 },
  { name: 'Spa', x0: 7.6, x1: GARDEN.x1, z0: GARDEN.z0, z1: 1.3, outdoor: true },
  { name: 'Terrasse', x0: GARDEN.x0, x1: 7.0, z0: GARDEN.z0, z1: GARDEN.z1, outdoor: true },
  { name: 'Jardin', x0: GARDEN.x0, x1: GARDEN.x1, z0: GARDEN.z0, z1: GARDEN.z1, outdoor: true },
];

export interface Ctx {
  b: Builder;
  root: THREE.Group;
  lights: Record<string, LightGroup>;
  sound: Sound;
  notify: (msg: string) => void;
  /** Matériaux exposés à l'extérieur (reçoivent la carte d'environnement extérieure). */
  outdoorMaterials: Set<THREE.Material>;
  /** Signale qu'un changement d'éclairage nécessite de recalculer les reflets. */
  dirtyEnv: () => void;
  quality: 'haute' | 'moyenne' | 'basse';
}
