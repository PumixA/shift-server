import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameState, Player, Tile } from './types/game';
import { processDiceRoll } from './engine/processor';
import { ActionType, TriggerType } from './types/rules';

// --- Configuration initiale ---
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Création du serveur HTTP pour Socket.io
const httpServer = createServer(app);

// Configuration de l'instance Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000", // Autorise ton front Next.js
        methods: ["GET", "POST"]
    }
});

// --- Stockage des états de jeu ---
const games: Record<string, GameState> = {};

// Route de test API
app.get('/', (req, res) => {
    res.send('Serveur SHIFT + Socket.io opérationnels !');
});

// --- Gestion des événements Temps Réel (Sprint 1) ---
io.on('connection', (socket) => {
    console.log(`🔌 Nouveau joueur connecté : ${socket.id}`);

    /**
     * Tâche SJDP-32 : Logique de "Rooms"
     */
    socket.on('join_room', (roomId: string) => {
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        socket.join(roomId);
        console.log(`🏠 Joueur ${socket.id} a rejoint la salle : ${roomId}`);

        // --- Initialisation / Récupération de la partie ---
        if (!games[roomId]) {
            // Création d'une nouvelle partie si elle n'existe pas
            const initialTiles: Tile[] = Array.from({ length: 20 }, (_, i) => ({
                id: `tile-${i}`,
                index: i,
                type: i === 0 ? 'start' : i === 19 ? 'end' : i % 5 === 0 ? 'special' : 'normal'
            }));

            games[roomId] = {
                roomId,
                tiles: initialTiles,
                players: [],
                currentTurn: "", // Sera défini quand le premier joueur rejoint
                status: 'playing',
                activeRules: [
                    {
                        id: "test-turbo",
                        trigger: TriggerType.ON_LAND,
                        priority: 1,
                        conditions: [],
                        effects: [
                            {
                                type: ActionType.MOVE_RELATIVE,
                                value: 2,
                                target: 'self'
                            }
                        ]
                    }
                ] // Initialisation des règles actives avec la règle de test
            };
            console.log(`✨ Nouvelle partie créée pour la salle ${roomId}`);
        }

        const game = games[roomId];

        // --- Nettoyage et Limitation (SJDP-Fix) ---
        // Si la partie est finie, on ne laisse pas rejoindre pour éviter l'accumulation
        // Sauf si on implémente un mode spectateur, mais ici on veut éviter les fantômes
        
        // Limitation à 2 joueurs actifs
        if (game.players.length >= 2) {
            // Vérifier si le joueur est déjà dedans (reconnexion)
            const existingPlayerIndex = game.players.findIndex(p => p.id === socket.id);
            
            if (existingPlayerIndex === -1) {
                // Si la salle est pleine et que ce n'est pas une reconnexion, on rejette ou on met en spectateur
                // Pour l'instant, on accepte mais on ne crée pas de nouveau joueur
                console.log(`⚠️ Salle ${roomId} pleine. ${socket.id} rejoint en spectateur.`);
            } else {
                console.log(`🔄 Reconnexion du joueur ${socket.id}`);
            }
        } else {
            // Ajout du joueur s'il n'est pas déjà présent
            const existingPlayer = game.players.find(p => p.id === socket.id);

            if (!existingPlayer) {
                const newPlayer: Player = {
                    id: socket.id,
                    color: game.players.length === 0 ? 'cyan' : 'violet', // Premier = cyan, Deuxième = violet
                    position: 0,
                    score: 0
                };
                game.players.push(newPlayer);
                
                // Si c'est le premier joueur, c'est son tour
                if (game.players.length === 1) {
                    game.currentTurn = newPlayer.id;
                }

                console.log(`👤 Joueur ${socket.id} ajouté à la partie (Couleur: ${newPlayer.color})`);
            }
        }

        socket.emit('room_joined', roomId);

        // Émission de l'état complet du jeu à TOUS les membres de la salle (y compris le nouveau)
        io.to(roomId).emit('game_state_sync', game);

        socket.to(roomId).emit('player_joined_room', {
            id: socket.id,
            message: "Un nouveau joueur est arrivé !"
        });
    });

    /**
     * Tâche SJDP-Fix : Reset Game
     */
    socket.on('reset_game', (data: { roomId: string }) => {
        const game = games[data.roomId];
        if (game) {
            console.log(`🔄 Reset de la partie ${data.roomId} demandé par ${socket.id}`);
            
            // Réinitialisation de l'état
            game.status = 'playing';
            game.players = []; // On vide les joueurs pour forcer une reconnexion propre ou on les reset
            game.currentTurn = "";
            
            // On notifie tout le monde que la partie a été reset
            // Les clients devront probablement rejoindre à nouveau ou on reset leurs positions
            // Pour simplifier, on reset les positions des joueurs connectés s'ils sont encore là
            // Mais comme on a vidé la liste, ils devront se reconnecter (F5) ou on gère ça mieux :
            
            // Option B : On garde les joueurs mais on reset leurs stats
            // game.players.forEach(p => {
            //     p.position = 0;
            //     p.score = 0;
            // });
            // if (game.players.length > 0) game.currentTurn = game.players[0].id;
            
            // Option A (Radicale pour dev) : On supprime la game
            delete games[data.roomId];
            
            io.to(data.roomId).emit('game_reset', { message: "La partie a été réinitialisée. Veuillez rafraîchir." });
        }
    });

    /**
     * Tâche SJDP-42 & SJDP-43 : Lancer de dé synchronisé
     */
    socket.on('roll_dice', (data: { roomId: string }) => {
        let game = games[data.roomId];
        
        // 1. Validation de la partie
        if (!game) {
            socket.emit('error', { message: "Partie introuvable." });
            return;
        }

        // Vérification si la partie est déjà finie
        if (game.status === 'finished') {
            socket.emit('error', { message: "La partie est terminée !" });
            return;
        }

        // 2. Sécurité : Vérification du tour
        if (game.currentTurn !== socket.id) {
            console.warn(`⚠️ Tentative de triche ou désynchro : ${socket.id} a essayé de jouer hors tour.`);
            socket.emit('error', { message: "Ce n'est pas votre tour !" });
            return;
        }

        // 3. Logique du jeu
        const diceValue = Math.floor(Math.random() * 6) + 1;
        console.log(`🎲 ${socket.id} a roulé un ${diceValue} dans la salle ${data.roomId}`);

        // --- DÉLÉGATION AU MOTEUR DE JEU (SJDP-54) ---
        game = processDiceRoll(game, socket.id, diceValue);
        games[data.roomId] = game; // Mise à jour de l'état global

        // Récupération du joueur mis à jour pour vérifier la victoire
        const player = game.players.find(p => p.id === socket.id);
        
        if (player) {
            // 4. Vérification de la victoire (SJDP-39)
            if (player.position === 19) {
                game.status = 'finished';
                console.log(`🏆 VICTOIRE : Joueur ${socket.id} a gagné dans la salle ${data.roomId}`);
                
                // On diffuse le mouvement final
                io.to(data.roomId).emit('dice_result', {
                    diceValue,
                    players: game.players,
                    currentTurn: game.currentTurn // Le tour ne change pas
                });

                // On annonce le gagnant
                io.to(data.roomId).emit('game_over', {
                    winnerId: player.id,
                    winnerName: `Player ${game.players.indexOf(player) + 1}` // Nom générique basé sur l'index
                });
            } else {
                // 5. Gestion du tour suivant (si pas de victoire)
                // On passe au joueur suivant dans la liste (boucle circulaire)
                const playerIndex = game.players.indexOf(player);
                const nextPlayerIndex = (playerIndex + 1) % game.players.length;
                game.currentTurn = game.players[nextPlayerIndex].id;

                // Diffusion normale
                io.to(data.roomId).emit('dice_result', {
                    diceValue,
                    players: game.players,
                    currentTurn: game.currentTurn
                });
            }
        }
    });

    /**
     * Tâche SJDP-34 : Test "Ping-Pong" (Validation Unitaire)
     */
    socket.on('ping_test', () => {
        console.log(`🏓 Ping reçu de ${socket.id}`);
        // Réponse immédiate uniquement à l'envoyeur
        socket.emit('pong_response', {
            message: "Pong !",
            serverTime: new Date().toLocaleTimeString()
        });
    });

    /**
     * Tâche SJDP-35 : Diffusion (Broadcast) de test
     * On simule un message envoyé à tous les membres d'une salle
     */
    socket.on('send_shout', (data: { roomId: string, message: string }) => {
        console.log(`📣 Shout dans ${data.roomId} par ${socket.id} : ${data.message}`);

        // On diffuse à TOUTE la room, incluant l'envoyeur
        io.to(data.roomId).emit('incoming_shout', {
            senderId: socket.id,
            message: data.message,
            timestamp: Date.now()
        });
    });

    /**
     * Tâche SJDP-28 : Gestion de la déconnexion
     */
    socket.on('disconnect', () => {
        console.log(`❌ Joueur déconnecté : ${socket.id}`);
        // Optionnel : Retirer le joueur de la partie ou marquer comme déconnecté
        // Pour l'instant, on garde l'état en mémoire
    });
});

// --- Lancement du serveur ---
httpServer.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 SHIFT Engine : http://localhost:${PORT}`);
    console.log(`⚡ Système Nerveux (Socket.io) Activé`);
    console.log(`🎲 Système de Jeu (Dice & Turns) : Prêt`);
    console.log(`-----------------------------------------`);
});