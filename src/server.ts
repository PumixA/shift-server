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

        socket.emit('room_joined', roomId);

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