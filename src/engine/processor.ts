import { GameState, RuleLog } from '../types/game';
import { ActionType, RuleEffect, TriggerType } from '../types/rules';
import { applyRuleEffect } from './actions';
import { getApplicableRules, sortRules, executeRuleChain } from './rule-evaluator';

export function processDiceRoll(gameState: GameState, playerId: string, diceValue: number): { state: GameState, logs: RuleLog[] } {
    let logs: RuleLog[] = [];

    // 1. Mouvement initial (Lancer de dé)
    const moveEffect: RuleEffect = {
        type: ActionType.MOVE_RELATIVE,
        value: diceValue,
        target: 'self'
    };

    let newState = applyRuleEffect(gameState, playerId, moveEffect);

    // Récupérer la nouvelle position du joueur
    const player = newState.players.find(p => p.id === playerId);
    const newPosition = player ? player.position : -1;

    // 2. Détection des conséquences (Trigger: ON_LAND)
    // On récupère les règles qui se déclenchent à l'atterrissage
    const applicableRules = getApplicableRules(newState, TriggerType.ON_LAND, { position: newPosition });

    // 3. Tri des règles par priorité
    const sortedRules = sortRules(applicableRules);

    // 4. Exécution de la chaîne de règles
    if (sortedRules.length > 0) {
        const result = executeRuleChain(newState, playerId, sortedRules);
        newState = result.state;
        logs = result.logs;
    }

    return { state: newState, logs };
}
