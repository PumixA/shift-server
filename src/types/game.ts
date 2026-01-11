import { Rule } from './rules';

export interface Tile {
    id: string;
    type: 'start' | 'end' | 'special' | 'normal';
    index: number; // Position linéaire 0-19
}

export interface Player {
    id: string;
    color: 'cyan' | 'violet';
    position: number; // Index sur le plateau
    score: number;
}

export interface GameState {
    roomId: string;
    tiles: Tile[];
    players: Player[];
    currentTurn: string; // ID du joueur dont c'est le tour
    status: 'playing' | 'finished';
    activeRules: Rule[];
}
