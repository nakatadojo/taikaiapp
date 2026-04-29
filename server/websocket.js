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
 *   tournament:{tournamentId}:competitors            — competitor CRUD events
 *   tournament:{tournamentId}:divisions              — division generation events
 *
 * Operator presence:
 *   _operatorPresence Map tracks which socket IDs are operating each bracket.
 *   When two operators join the same bracket the client receives
 *   `operator:presence` with count > 1 and can warn the user.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

// bracketRoom → Set of socket IDs currently operating that bracket
const _operatorPresence = new Map();

/**
 * Extract the `token` cookie value from a raw Cookie header string.
 * Avoids pulling in the `cookie` npm package for a single use-case.
 */
function _parseCookieToken(cookieHeader) {
    const match = /(?:^|;\s*)token=([^;]+)/.exec(cookieHeader || '');
    return match ? decodeURIComponent(match[1]) : null;
}

function _presenceRoom(tournamentId, bracketId) {
    return `tournament:${tournamentId}:bracket:${bracketId}`;
}

/** Broadcast current operator count for a bracket to all subscribers. */
function _broadcastPresence(tournamentId, bracketId) {
    const room = _presenceRoom(tournamentId, bracketId);
    const count = (_operatorPresence.get(room) || new Set()).size;
    io.to(room).emit('operator:presence', { bracketId, count });
}

function initWebSocket(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: false },
        transports: ['websocket', 'polling'],
    });

    // ── Authentication gate ────────────────────────────────────────────────────
    io.on('connection', (socket) => {
        const token = _parseCookieToken(socket.handshake.headers.cookie);
        if (!token) {
            socket.disconnect(true);
            return;
        }
        try {
            socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            socket.disconnect(true);
            return;
        }

        // ── Subscriptions ────────────────────────────────────────────────────

        socket.on('subscribe:bracket', ({ tournamentId, bracketId }) => {
            if (!tournamentId || !bracketId) return;
            socket.join(_presenceRoom(tournamentId, bracketId));
        });

        socket.on('subscribe:ring', ({ tournamentId, ring }) => {
            if (!tournamentId || ring == null) return;
            socket.join(`tournament:${tournamentId}:ring:${ring}:scoreboard`);
        });

        socket.on('subscribe:competitors', ({ tournamentId }) => {
            if (!tournamentId) return;
            socket.join(`tournament:${tournamentId}:competitors`);
        });

        socket.on('subscribe:divisions', ({ tournamentId }) => {
            if (!tournamentId) return;
            socket.join(`tournament:${tournamentId}:divisions`);
        });

        // ── Operator presence ────────────────────────────────────────────────
        // Emitted when an operator opens a bracket for scoring.
        // Lets other devices on the same bracket see that someone is already working it.

        socket.on('operator:join-bracket', ({ tournamentId, bracketId }) => {
            if (!tournamentId || !bracketId) return;
            const room = _presenceRoom(tournamentId, bracketId);

            // Ensure the socket is in the bracket room (may have already subscribed)
            socket.join(room);

            // Track this socket as an active operator
            if (!_operatorPresence.has(room)) _operatorPresence.set(room, new Set());
            _operatorPresence.get(room).add(socket.id);

            // Store on socket data so we can clean up on disconnect
            socket.data.operatorRooms = socket.data.operatorRooms || [];
            socket.data.operatorRooms.push({ tournamentId, bracketId, room });

            _broadcastPresence(tournamentId, bracketId);
        });

        socket.on('operator:leave-bracket', ({ tournamentId, bracketId }) => {
            if (!tournamentId || !bracketId) return;
            const room = _presenceRoom(tournamentId, bracketId);
            const set = _operatorPresence.get(room);
            if (set) {
                set.delete(socket.id);
                if (set.size === 0) _operatorPresence.delete(room);
            }
            _broadcastPresence(tournamentId, bracketId);
        });

        // Clean up presence on disconnect
        socket.on('disconnect', () => {
            const rooms = socket.data.operatorRooms || [];
            for (const { tournamentId, bracketId, room } of rooms) {
                const set = _operatorPresence.get(room);
                if (set) {
                    set.delete(socket.id);
                    if (set.size === 0) _operatorPresence.delete(room);
                }
                _broadcastPresence(tournamentId, bracketId);
            }
        });
    });

    return io;
}

function getIO() {
    if (!io) throw new Error('WebSocket server not initialized');
    return io;
}

function broadcastBracketUpdate(tournamentId, bracketId, bracketData) {
    if (!io) return;
    io.to(_presenceRoom(tournamentId, bracketId)).emit('bracket:updated', {
        bracketId,
        bracket: bracketData,
    });
}

function broadcastScoreboardUpdate(tournamentId, ring, state) {
    if (!io) return;
    io.to(`tournament:${tournamentId}:ring:${ring}:scoreboard`).emit('scoreboard:updated', {
        ring,
        state,
    });
}

function broadcastCompetitorUpdate(tournamentId, action, competitor) {
    if (!io) return;
    io.to(`tournament:${tournamentId}:competitors`).emit('competitors:updated', {
        action,
        competitor,
    });
}

function broadcastDivisionUpdate(tournamentId, generatedDivisions) {
    if (!io) return;
    io.to(`tournament:${tournamentId}:divisions`).emit('divisions:updated', { generatedDivisions });
}

module.exports = {
    initWebSocket, getIO,
    broadcastBracketUpdate, broadcastScoreboardUpdate,
    broadcastCompetitorUpdate, broadcastDivisionUpdate,
};
