import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

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

// --- Interfaces ---
interface Tile {
    id: string;
    type: 'start' | 'end' | 'special' | 'normal';
    index: number; // Position linéaire 0-19
}

interface Player {
    id: string;
    color: 'cyan' | 'violet';
    position: number; // Index sur le plateau
    score: number;
}

interface GameState {
    roomId: string;
    tiles: Tile[];
    players: Player[];
}

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
                players: []
            };
            console.log(`✨ Nouvelle partie créée pour la salle ${roomId}`);
        }

        // Ajout du joueur s'il n'est pas déjà présent
        const game = games[roomId];
        const existingPlayer = game.players.find(p => p.id === socket.id);

        if (!existingPlayer) {
            const newPlayer: Player = {
                id: socket.id,
                color: game.players.length === 0 ? 'cyan' : 'violet', // Premier = cyan, Deuxième = violet
                position: 0,
                score: 0
            };
            game.players.push(newPlayer);
            console.log(`👤 Joueur ${socket.id} ajouté à la partie (Couleur: ${newPlayer.color})`);
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
    console.log(`🧪 Tests Ping & Shout : Prêts`);
    console.log(`-----------------------------------------`);
});