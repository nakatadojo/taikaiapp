/**
 * server/websocket.js
 *
 * WebSocket server using socket.io.
 *
 * Railway supports WebSockets natively on the same port as HTTP.
 * No special config needed: app listens on process.env.PORT and
 * WebSocket upgrades happen on the same port as HTTP.
 *
 * Rooms used:
 *   tournament:{tournamentId}:bracket:{bracketId}   — bracket updates
 *   tournament:{tournamentId}:ring:{ring}:scoreboard — scoreboard updates
 */

const { Server } = require('socket.io');

let io;

function initWebSocket(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        // polling fallback ensures Railway and CDN proxies work
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        // Subscribe to a tournament's bracket channel
        socket.on('subscribe:bracket', ({ tournamentId, bracketId }) => {
            if (!tournamentId || !bracketId) return;
            socket.join(`tournament:${tournamentId}:bracket:${bracketId}`);
        });

        // Subscribe to a ring's scoreboard channel
        socket.on('subscribe:ring', ({ tournamentId, ring }) => {
            if (!tournamentId || ring == null) return;
            socket.join(`tournament:${tournamentId}:ring:${ring}:scoreboard`);
        });

        // Subscribe to a tournament's competitors channel
        socket.on('subscribe:competitors', ({ tournamentId }) => {
            if (!tournamentId) return;
            socket.join(`tournament:${tournamentId}:competitors`);
        });

        // Subscribe to a tournament's divisions channel
        socket.on('subscribe:divisions', ({ tournamentId }) => {
            if (!tournamentId) return;
            socket.join(`tournament:${tournamentId}:divisions`);
        });

        // socket.io handles room cleanup automatically on disconnect
    });

    return io;
}

function getIO() {
    if (!io) throw new Error('WebSocket server not initialized');
    return io;
}

/**
 * Emit bracket update to all subscribers of this bracket.
 * Called by upsertSingleBracket after writing to DB.
 */
function broadcastBracketUpdate(tournamentId, bracketId, bracketData) {
    if (!io) return;
    io.to(`tournament:${tournamentId}:bracket:${bracketId}`).emit('bracket:updated', {
        bracketId,
        bracket: bracketData,
    });
}

/**
 * Emit scoreboard update to all subscribers of this ring.
 * Called by setScoreboardState after writing to DB.
 */
function broadcastScoreboardUpdate(tournamentId, ring, state) {
    if (!io) return;
    io.to(`tournament:${tournamentId}:ring:${ring}:scoreboard`).emit('scoreboard:updated', {
        ring,
        state,
    });
}

/**
 * Emit competitor update to all subscribers of this tournament's competitors channel.
 * Called by directorCompetitorsController after each write.
 */
function broadcastCompetitorUpdate(tournamentId, action, competitor) {
    if (!io) return;
    io.to(`tournament:${tournamentId}:competitors`).emit('competitors:updated', {
        action, // 'add' | 'update' | 'delete'
        competitor,
    });
}

/**
 * Emit division update to all subscribers of this tournament's divisions channel.
 * Called by divisionsController after auto-assign.
 */
function broadcastDivisionUpdate(tournamentId, generatedDivisions) {
    if (!io) return;
    io.to(`tournament:${tournamentId}:divisions`).emit('divisions:updated', { generatedDivisions });
}

module.exports = { initWebSocket, getIO, broadcastBracketUpdate, broadcastScoreboardUpdate, broadcastCompetitorUpdate, broadcastDivisionUpdate };
