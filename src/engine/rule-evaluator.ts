import { GameState, RuleLog } from '../types/game';
import { ActionType, Rule, TriggerType } from '../types/rules';
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
    return gameState.activeRules.filter(rule => {
        if (rule.trigger !== trigger) {
            return false;
        }

        if (rule.tileIndex !== undefined && context.position !== undefined) {
            if (rule.tileIndex !== context.position) {
                return false;
            }
        }

        return true;
    });
}

export function executeRuleChain(gameState: GameState, playerId: string, rules: Rule[]): { state: GameState, logs: RuleLog[] } {
    let currentGameState = gameState;
    const logs: RuleLog[] = [];
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
            
            // Génération du message de log
            let message = "";
            switch (effect.type) {
                case ActionType.MOVE_RELATIVE:
                    const val = Number(effect.value);
                    message = val > 0 ? `Déplacement supplémentaire (+${val})` : `Recul (${val})`;
                    break;
                case ActionType.TELEPORT:
                    message = `Téléportation vers la case ${Number(effect.value) + 1}`;
                    break;
                case ActionType.SWAP_POSITIONS:
                    message = "Échange de positions";
                    break;
                case ActionType.BACK_TO_START:
                    message = "Retour à la case départ";
                    break;
                case ActionType.SKIP_TURN:
                    message = "Tour passé";
                    break;
                case ActionType.EXTRA_TURN:
                    message = "Tour supplémentaire";
                    break;
                case ActionType.MODIFY_SCORE:
                    message = "Score modifié";
                    break;
                default:
                    message = "Effet spécial activé";
            }
            
            logs.push({
                ruleId: rule.id,
                message: message
            });
        }

        iterations++;
    }

    return { state: currentGameState, logs };
}
