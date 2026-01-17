import { GameState } from '../types/game';
import { TriggerType } from '../types/rules';
import { getApplicableRules, executeRuleChain } from './rule-evaluator';

export const processDiceRoll = (gameState: GameState, playerId: string, diceValue: number): { newState: GameState, logs: string[] } => {
  let newState = JSON.parse(JSON.stringify(gameState)); // 1. Clone State
  const logs: string[] = [];
  const playerIndex = newState.players.findIndex((p: any) => p.id === playerId);
  
  if (playerIndex === -1) return { newState, logs: ['❌ Error: Player not found'] };

  // --- PHASE 1: START OF MOVE TRIGGERS ---
  // Check for rules that happen BEFORE moving (e.g. "Gain 100 gold at start of turn")
  const startPosition = newState.players[playerIndex].position;
  const startRules = getApplicableRules(newState, startPosition, TriggerType.ON_MOVE_START); 
  
  if (startRules.length > 0) {
    logs.push(`🏁 Phase 1: Start Triggers (${startRules.length})`);
    const result = executeRuleChain(newState, playerId, startRules);
    newState = result.state; // Update state immediately
    logs.push(...result.logs);
  }

  // --- PHASE 2: PHYSICS (The Movement) ---
  // Recalculate position based on potentially modified state from Phase 1
  const currentPos = newState.players[playerIndex].position;
  let newPosition = currentPos + diceValue;
  
  // Optional: Cap at 20 (Goal) if needed, or keep infinite
  // newPosition = Math.min(newPosition, 20); 

  newState.players[playerIndex].position = newPosition;
  logs.push(`🎲 Dice Roll: ${diceValue}. Moved ${currentPos} -> ${newPosition}`);

  // --- PHASE 3: LANDING TRIGGERS ---
  // Check for rules on the destination tile (e.g. "Trap on tile 5")
  const landRules = getApplicableRules(newState, newPosition, TriggerType.ON_LAND);
  
  if (landRules.length > 0) {
    logs.push(`📍 Phase 3: Land Triggers (${landRules.length})`);
    const result = executeRuleChain(newState, playerId, landRules);
    newState = result.state; // Update state again
    logs.push(...result.logs);
  }

  return { newState, logs };
};
