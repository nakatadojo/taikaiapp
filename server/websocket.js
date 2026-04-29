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
 *   A `operator:lock-warning` is emitted to the newcomer if another
 *   operator is already active.
 *
 * Message sequencing:
 *   Every broadcast carries a monotonic `seq` number per room and a
 *   `serverTime` timestamp (ms since epoch).  Clients pass their
 *   `lastSeq` when (re-)subscribing; the server replays any buffered
 *   messages they missed.
 *
 * Replay buffer:
 *   Last 50 messages per room, max 5-minute TTL.  Cleared on server
 *   restart (in-process only — good enough for reconnect recovery).
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

// bracketRoom → Set of socket IDs currently operating that bracket
const _operatorPresence = new Map();

// ── Sequence counters ─────────────────────────────────────────────────────────
// roomId → monotonic integer, incremented on every broadcast
const _roomSeq = new Map();

function _nextSeq(roomId) {
  const n = (_roomSeq.get(roomId) || 0) + 1;
  _roomSeq.set(roomId, n);
  return n;
}

// ── Replay buffer ─────────────────────────────────────────────────────────────
// roomId → Array<{ seq, eventName, payload, ts }>
// Keeps the last 50 messages for up to 5 minutes so reconnecting clients
// can catch up without a full state fetch.
const _replayBuffer = new Map();
const _REPLAY_MAX    = 50;
const _REPLAY_TTL_MS = 5 * 60 * 1000;

function _bufferMessage(roomId, seq, eventName, payload) {
  const now = Date.now();
  if (!_replayBuffer.has(roomId)) _replayBuffer.set(roomId, []);
  const buf = _replayBuffer.get(roomId);
  buf.push({ seq, eventName, payload, ts: now });
  // Trim by count
  while (buf.length > _REPLAY_MAX) buf.shift();
  // Trim by TTL
  const cutoff = now - _REPLAY_TTL_MS;
  while (buf.length > 0 && buf[0].ts < cutoff) buf.shift();
}

function _replaySince(socket, roomId, lastSeq) {
  if (typeof lastSeq !== 'number') return;
  const buf = _replayBuffer.get(roomId) || [];
  for (const entry of buf) {
    if (entry.seq > lastSeq) socket.emit(entry.eventName, entry.payload);
  }
}

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
  const room  = _presenceRoom(tournamentId, bracketId);
  const count = (_operatorPresence.get(room) || new Set()).size;
  io.to(room).emit('operator:presence', { bracketId, count });
}

function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: false },
    transports: ['websocket', 'polling'],
    // Keep connections alive through Railway's nginx proxy (60 s idle timeout).
    // 10 s ping interval ensures the connection is never idle long enough to drop.
    pingInterval: 10000,
    pingTimeout:   5000,
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

    // Send server time on connect so clients can compute clock offset
    socket.emit('server:time', { serverTime: Date.now() });

    // ── Subscriptions ────────────────────────────────────────────────────
    socket.on('subscribe:bracket', ({ tournamentId, bracketId, lastSeq }) => {
      if (!tournamentId || !bracketId) return;
      const room = _presenceRoom(tournamentId, bracketId);
      socket.join(room);
      const currentSeq = _roomSeq.get(room) || 0;
      socket.emit('subscribe:ack', {
        room: 'bracket', tournamentId, bracketId,
        seq: currentSeq, serverTime: Date.now(),
      });
      // Replay any messages the client missed while disconnected
      _replaySince(socket, room, lastSeq);
    });

    socket.on('subscribe:ring', ({ tournamentId, ring, lastSeq }) => {
      if (!tournamentId || ring == null) return;
      const room = `tournament:${tournamentId}:ring:${ring}:scoreboard`;
      socket.join(room);
      const currentSeq = _roomSeq.get(room) || 0;
      socket.emit('subscribe:ack', {
        room: 'ring', tournamentId, ring,
        seq: currentSeq, serverTime: Date.now(),
      });
      _replaySince(socket, room, lastSeq);
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

      // Warn the newcomer if another operator is already active on this bracket
      const existing = _operatorPresence.get(room);
      const existingCount = existing ? existing.size : 0;
      if (existingCount > 0) {
        socket.emit('operator:lock-warning', {
          bracketId,
          count: existingCount,
          message: `${existingCount} operator${existingCount > 1 ? 's are' : ' is'} already scoring this bracket. Coordinate before making changes.`,
        });
      }

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
      const set  = _operatorPresence.get(room);
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
  const room    = _presenceRoom(tournamentId, bracketId);
  const seq     = _nextSeq(room);
  const payload = { bracketId, bracket: bracketData, seq, serverTime: Date.now() };
  _bufferMessage(room, seq, 'bracket:updated', payload);
  io.to(room).emit('bracket:updated', payload);
}

function broadcastScoreboardUpdate(tournamentId, ring, state) {
  if (!io) return;
  const room    = `tournament:${tournamentId}:ring:${ring}:scoreboard`;
  const seq     = _nextSeq(room);
  const payload = { ring, state, seq, serverTime: Date.now() };
  _bufferMessage(room, seq, 'scoreboard:updated', payload);
  io.to(room).emit('scoreboard:updated', payload);
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
