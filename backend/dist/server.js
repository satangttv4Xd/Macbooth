import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import { db } from './db.js';
dotenv.config();
const PORT = process.env.PORT || 3001;
const ADMIN_PIN = process.env.ADMIN_PIN || '1337';
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'DELETE'],
    },
});
app.use(cors());
app.use(express.json());
// In-memory active sessions for real-time SOC BigScreen
const activePlayers = new Map();
// Helper to get local network IPv4 address
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
// REST API Endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', app: 'MAC DEFENDER API', timestamp: new Date().toISOString() });
});
app.get('/api/network-info', (req, res) => {
    const localIp = getLocalIp();
    res.json({
        localIp,
        port: PORT,
        playerUrl: `http://${localIp}:5173`,
        bigscreenUrl: `http://${localIp}:5173/bigscreen`,
        adminUrl: `http://${localIp}:5173/admin`,
        leaderboardUrl: `http://${localIp}:5173/leaderboard`,
    });
});
app.get('/api/leaderboard', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const list = db.getLeaderboard(limit);
    res.json({ success: true, leaderboard: list });
});
app.post('/api/leaderboard', (req, res) => {
    try {
        const { nickname, score, rank, timeFormatted, timeSeconds, threatsBlocked, difficulty } = req.body;
        if (!nickname || typeof score !== 'number') {
            res.status(400).json({ success: false, error: 'Nickname and score are required' });
            return;
        }
        const entry = db.addLeaderboardEntry({
            nickname: String(nickname).substring(0, 15).toUpperCase(),
            score,
            rank: rank || 'B',
            timeFormatted: timeFormatted || '05:00',
            timeSeconds: timeSeconds || 300,
            threatsBlocked: threatsBlocked || 0,
            difficulty: difficulty || 'normal',
        });
        // Notify all connected clients of leaderboard update
        io.emit('soc:leaderboard_updated', db.getLeaderboard(20));
        io.emit('soc:event_log', {
            type: 'LEADERBOARD_ENTRY',
            text: `🏆 [${entry.nickname}] recorded score ${entry.score.toLocaleString()} (Rank ${entry.rank})!`,
            timestamp: Date.now(),
        });
        res.json({ success: true, entry });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.delete('/api/leaderboard/:id', (req, res) => {
    const pin = req.headers['x-admin-pin'];
    if (pin !== ADMIN_PIN) {
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        return;
    }
    const deleted = db.deleteLeaderboardEntry(req.params.id);
    if (deleted) {
        io.emit('soc:leaderboard_updated', db.getLeaderboard(20));
        res.json({ success: true, message: 'Entry deleted' });
    }
    else {
        res.status(404).json({ success: false, error: 'Entry not found' });
    }
});
app.post('/api/admin/reset-leaderboard', (req, res) => {
    const pin = req.headers['x-admin-pin'];
    if (pin !== ADMIN_PIN) {
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        return;
    }
    db.resetLeaderboard();
    io.emit('soc:leaderboard_updated', []);
    io.emit('soc:event_log', {
        type: 'ADMIN_RESET',
        text: `⚠️ [ADMIN] Leaderboard has been reset for new booth session.`,
        timestamp: Date.now(),
    });
    res.json({ success: true, message: 'Leaderboard reset successfully' });
});
app.get('/api/stats', (req, res) => {
    const stats = db.getStats();
    res.json({ success: true, stats, activePlayersCount: activePlayers.size });
});
app.post('/api/game/start', (req, res) => {
    const { difficulty } = req.body;
    db.recordGameStart(difficulty || 'normal');
    res.json({ success: true });
});
app.post('/api/game/mission-outcome', (req, res) => {
    const { missionIndex, isCorrect } = req.body;
    if (typeof missionIndex === 'number' && typeof isCorrect === 'boolean') {
        db.recordMissionOutcome(missionIndex, isCorrect);
    }
    res.json({ success: true });
});
app.get('/api/settings', (req, res) => {
    res.json({ success: true, settings: db.getSettings() });
});
app.post('/api/settings', (req, res) => {
    const pin = req.headers['x-admin-pin'];
    if (pin !== ADMIN_PIN) {
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        return;
    }
    const updated = db.updateSettings(req.body);
    io.emit('admin:settings_updated', updated);
    res.json({ success: true, settings: updated });
});
// Socket.IO Real-Time Management
io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    // Send current state to newly connected client
    socket.emit('soc:active_players', Array.from(activePlayers.values()));
    socket.emit('soc:leaderboard_updated', db.getLeaderboard(20));
    // Player station registers
    socket.on('player:register', (data) => {
        const session = {
            id: data.id,
            socketId: socket.id,
            nickname: data.nickname || 'ANONYMOUS',
            score: 0,
            threatLevel: 0,
            currentMission: 1,
            missionTitle: 'Phishing Awareness',
            status: 'active',
            difficulty: data.difficulty || 'normal',
            timeRemaining: 300,
            threatsBlocked: 0,
            combo: 1,
            lastActive: Date.now(),
            deviceIp: clientIp,
        };
        activePlayers.set(data.id, session);
        io.emit('soc:active_players', Array.from(activePlayers.values()));
        io.emit('soc:event_log', {
            type: 'PLAYER_JOIN',
            text: `💻 [${session.nickname}] joined the defense grid (Mode: ${session.difficulty.toUpperCase()}).`,
            timestamp: Date.now(),
        });
    });
    // Player station updates its live status (during gameplay)
    socket.on('player:update_state', (update) => {
        const existing = activePlayers.get(update.id);
        if (existing) {
            const updatedSession = {
                ...existing,
                ...update,
                socketId: socket.id,
                lastActive: Date.now(),
            };
            activePlayers.set(update.id, updatedSession);
            io.emit('soc:active_players', Array.from(activePlayers.values()));
            // Broadcast high threat alerts
            if (update.threatLevel && update.threatLevel >= 75 && (existing.threatLevel < 75)) {
                io.emit('soc:event_log', {
                    type: 'CRITICAL_THREAT',
                    text: `🚨 CRITICAL ALERT: [${updatedSession.nickname}] Threat Level reached ${update.threatLevel}%!`,
                    timestamp: Date.now(),
                });
            }
        }
    });
    // Player finishes game (success or fail)
    socket.on('player:finish_game', (data) => {
        const session = activePlayers.get(data.id);
        if (session) {
            session.status = data.status;
            session.score = data.score;
            io.emit('soc:active_players', Array.from(activePlayers.values()));
            io.emit('soc:event_log', {
                type: data.status === 'completed' ? 'MISSION_COMPLETE' : 'SYSTEM_COMPROMISED',
                text: data.status === 'completed'
                    ? `🛡️ MISSION CLEARED: [${session.nickname}] saved their Mac! Final Score: ${data.score}`
                    : `💀 BREACH: [${session.nickname}] system was overwhelmed by attackers!`,
                timestamp: Date.now(),
            });
        }
    });
    // Admin / MC triggers remote demo action
    socket.on('admin:trigger_action', (action) => {
        if (action.pin !== ADMIN_PIN) {
            socket.emit('admin:error', { message: 'Invalid Admin PIN' });
            return;
        }
        // Broadcast action to all players or targeted player
        io.emit('admin:remote_event', action);
        io.emit('soc:event_log', {
            type: 'MC_TRIGGER',
            text: `🎤 [BOOTH MC] Triggered Stage Event: ${action.type}${action.message ? ` - "${action.message}"` : ''}`,
            timestamp: Date.now(),
        });
    });
    // Disconnect cleanup
    socket.on('disconnect', () => {
        for (const [id, session] of activePlayers.entries()) {
            if (session.socketId === socket.id) {
                activePlayers.delete(id);
                io.emit('soc:active_players', Array.from(activePlayers.values()));
                break;
            }
        }
    });
});
// Periodic cleanup of stale sessions (> 10 mins inactive)
setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, session] of activePlayers.entries()) {
        if (now - session.lastActive > 10 * 60 * 1000) {
            activePlayers.delete(id);
            changed = true;
        }
    }
    if (changed) {
        io.emit('soc:active_players', Array.from(activePlayers.values()));
    }
}, 30000);
// Start server
server.listen(PORT, () => {
    const localIp = getLocalIp();
    console.log('\n======================================================');
    console.log('   🍎 MAC DEFENDER — SURVIVE THE HACK (BACKEND)   ');
    console.log('======================================================');
    console.log(`📡 Local Server:     http://localhost:${PORT}`);
    console.log(`🌐 Booth Network:    http://${localIp}:${PORT}`);
    console.log('------------------------------------------------------');
    console.log(`💻 Player Station:   http://${localIp}:5173`);
    console.log(`📺 Big Screen SOC:   http://${localIp}:5173/bigscreen`);
    console.log(`🏆 Live Standings:   http://${localIp}:5173/leaderboard`);
    console.log(`🎛️ Booth MC Admin:   http://${localIp}:5173/admin (PIN: ${ADMIN_PIN})`);
    console.log('======================================================\n');
});
