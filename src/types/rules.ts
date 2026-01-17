export enum TriggerType {
  // Mouvement
  ON_MOVE_START = 'ON_MOVE_START',
  ON_PASS_OVER = 'ON_PASS_OVER',
  ON_LAND = 'ON_LAND',
  ON_BACKWARD_MOVE = 'ON_BACKWARD_MOVE',
  ON_TELEPORT = 'ON_TELEPORT',

  // Tour
  ON_TURN_START = 'ON_TURN_START',
  ON_TURN_END = 'ON_TURN_END',
  ON_DICE_ROLL = 'ON_DICE_ROLL',

  // Interaction
  ON_PLAYER_BYPASS = 'ON_PLAYER_BYPASS',
  ON_SAME_TILE = 'ON_SAME_TILE',
}

export enum ActionType {
  // Mouvement
  MOVE_RELATIVE = 'MOVE_RELATIVE',
  TELEPORT = 'TELEPORT',
  SWAP_POSITIONS = 'SWAP_POSITIONS',
  BACK_TO_START = 'BACK_TO_START',
  MOVE_TO_TILE = 'MOVE_TO_TILE', // Added for compatibility

  // Flux
  SKIP_TURN = 'SKIP_TURN',
  EXTRA_TURN = 'EXTRA_TURN',

  // Stats
  MODIFY_SCORE = 'MODIFY_SCORE',
  MODIFY_STAT = 'MODIFY_STAT', // Added for compatibility
}

export interface RuleEffect {
  type: ActionType | string; // Allow string for flexibility with legacy/future types
  value: number | string;
  target: 'self' | 'all' | 'others';
}

export interface Rule {
  id: string;
  title?: string; // Added title property
  trigger: TriggerType;
  tileIndex?: number;
  conditions?: any[];
  effects: RuleEffect[];
  priority: number;
}
