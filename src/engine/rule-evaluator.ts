import { GameState, RuleLog, RuleResult } from '../types/game';
import { ActionType, Rule, TriggerType } from '../types/rules';
import { applyRuleEffect } from './actions';

/**
 * Filter the list of active rules to find those matching the current event.
 * @param state The current game state (containing all active rules).
 * @param contextData Data about the event (e.g., player position, dice value).
 * @param triggerType The type of event triggering the check (e.g., 'ON_LAND').
 */
export function getApplicableRules(state: GameState, contextData: any, triggerType: string): Rule[] {
  // Defensive check
  if (!state.activeRules || state.activeRules.length === 0) {
    return [];
  }

  // Filter rules
  const matches = state.activeRules.filter(rule => {
    // 1. Check Trigger Type (Must match exactly)
    // Handle cases where rule.trigger is an object or a string
    const ruleTriggerType = (typeof rule.trigger === 'object') ? (rule.trigger as any).type : rule.trigger;
    
    if (ruleTriggerType !== triggerType) {
      return false;
    }

    // 2. Check Context (Specific Conditions)
    // For 'ON_LAND', we check if the rule's tile index matches the player's position.
    if (triggerType === 'ON_LAND') {
        // Safe conversion to numbers for comparison
        const ruleTile = Number(rule.tileIndex); 
        const playerPos = Number(contextData);

        // If rule has a specific tile, it MUST match.
        // If rule.tileIndex is null, it applies to ALL tiles (Global Rule).
        if (rule.tileIndex !== null && rule.tileIndex !== undefined) {
            if (ruleTile !== playerPos) return false;
        }
    }

    // Future triggers (ON_DICE_ROLL, etc.) will go here...

    return true; // It's a match!
  });

  // Log for debugging
  if (matches.length > 0) {
    console.log(`🔎 [RULE-EVALUATOR] Found ${matches.length} matching rules for ${triggerType} at val ${contextData}`);
  }

  return matches;
}

export function sortRules(rules: Rule[]): Rule[] {
    return rules.sort((a, b) => {
        // Critère 1 : Priorité (1 = Haute, donc ASC)
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        // Critère 2 : ID (ASC) pour simuler FIFO si pas de date
        return a.id.localeCompare(b.id);
    });
}

/**
 * Applies a list of rules sequentially to the game state.
 * Uses Deep Cloning to ensure immutability during calculation.
 */
export function executeRuleChain(initialState: GameState, playerId: string, rules: Rule[]): RuleResult {
  // 1. Deep Clone to create a "Sandboxed State" for calculation
  let currentState = JSON.parse(JSON.stringify(initialState));
  const logs: string[] = [];

  // 2. Locate the active player in the cloned state
  const player = currentState.players.find((p: any) => p.id === playerId);
  if (!player) {
    logs.push('❌ Critical: Player not found in execution state.');
    return { state: initialState, logs };
  }

  // 3. Iterate through rules (FIFO - assumed sorted by caller)
  for (const rule of rules) {
    logs.push(`⚡ Executing Rule: "${rule.title || rule.id}"`);

    // 4. Iterate through effects of the rule
    for (const effect of rule.effects) {
      const val = Number(effect.value); // Safety cast

      switch (effect.type) {
        // --- SCORE & STATS ---
        case 'MODIFY_SCORE':
        case 'MODIFY_STAT': // Handle potential legacy naming
          const oldScore = player.score || 0;
          player.score = oldScore + val;
          logs.push(`   -> Score: ${oldScore} => ${player.score} (${val > 0 ? '+' : ''}${val})`);
          break;

        // --- MOVEMENT ---
        case 'MOVE_RELATIVE':
          const startPos = player.position;
          // Prevent negative position
          player.position = Math.max(0, player.position + val);
          logs.push(`   -> Move: Tile ${startPos} => ${player.position}`);
          break;

        case 'TELEPORT':
        case 'MOVE_TO_TILE':
          player.position = val;
          logs.push(`   -> Teleport: Jumped to Tile ${val}`);
          break;

        // --- FUTURE ACTIONS (Placeholders) ---
        case 'SKIP_TURN':
          logs.push(`   -> Effect SKIP_TURN applied (Logic to be implemented in Turn Manager)`);
          break;

        default:
          logs.push(`   ⚠️ Unknown Effect Type: ${effect.type}`);
      }
    }
  }

  return { state: currentState, logs };
}
