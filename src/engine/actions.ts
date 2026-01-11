import { GameState } from '../types/game';
import { RuleEffect, ActionType } from '../types/rules';

export function applyRuleEffect(gameState: GameState, playerId: string, effect: RuleEffect): GameState {
    // Clone de l'état pour respecter le principe de fonction pure (immutabilité superficielle)
    const newGameState: GameState = {
        ...gameState,
        players: gameState.players.map(p => ({ ...p }))
    };

    const player = newGameState.players.find(p => p.id === playerId);

    if (!player) {
        return gameState;
    }

    switch (effect.type) {
        case ActionType.MOVE_RELATIVE:
            const moveValue = Number(effect.value);
            let newPosition = player.position + moveValue;

            // Limites du plateau (0 - 19)
            if (newPosition < 0) newPosition = 0;
            if (newPosition > 19) newPosition = 19;

            player.position = newPosition;
            break;

        case ActionType.TELEPORT:
            const teleportValue = Number(effect.value);
            // On suppose que la valeur de téléportation est valide, mais on pourrait ajouter des checks
            player.position = teleportValue;
            break;

        case ActionType.MODIFY_SCORE:
            const scoreValue = Number(effect.value);
            player.score += scoreValue;
            break;

        default:
            // Si l'action n'est pas reconnue, on retourne l'état original (ou le clone inchangé)
            // Ici on retourne le clone inchangé car on a déjà cloné.
            // Mais pour être strict sur "retourne le gameState inchangé" si type inconnu:
            return gameState;
    }

    return newGameState;
}
