import { GameState } from '../types/game';
import { Rule, TriggerType } from '../types/rules';
import { applyRuleEffect } from './actions';

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

export function getApplicableRules(gameState: GameState, trigger: TriggerType, context: any): Rule[] {
    // Filtre simple sur le trigger pour l'instant
    // On pourrait ajouter ici la vérification des conditions (ex: si joueur sur case X)
    return gameState.activeRules.filter(rule => rule.trigger === trigger);
}

export function executeRuleChain(gameState: GameState, playerId: string, rules: Rule[]): GameState {
    let currentGameState = gameState;
    const MAX_ITERATIONS = 10; // Sécurité anti-boucle infinie
    let iterations = 0;

    for (const rule of rules) {
        if (iterations >= MAX_ITERATIONS) {
            console.warn("⚠️ Limite de chaîne de règles atteinte. Arrêt forcé.");
            break;
        }

        console.log(`⚡ Application de la règle ${rule.id} (${rule.trigger})`);
        
        // Appliquer tous les effets de la règle
        for (const effect of rule.effects) {
            currentGameState = applyRuleEffect(currentGameState, playerId, effect);
        }

        iterations++;
    }

    return currentGameState;
}
