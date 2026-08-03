/**
 * Orion IDE — Yjs CRDT document rooms (server relay)
 *
 * One shared Y.Doc per roomId. Clients speak y-protocols sync + awareness
 * over binary WebSocket frames (compatible with y-websocket client).
 */

const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

/** @type {Map<string, { doc: Y.Doc, awareness: awarenessProtocol.Awareness, cons: Set }>} */
const docs = new Map();

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const getOrCreate = (roomId) => {
  let entry = docs.get(roomId);
  if (entry) return entry;
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  entry = { doc, awareness, cons: new Set() };
  docs.set(roomId, entry);

  // Persist updates into the doc; fan-out to peers happens in bindYjsSocket
  doc.on('update', (update, origin) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const payload = encoding.toUint8Array(encoder);
    for (const client of entry.cons) {
      if (client !== origin && client.readyState === 1) {
        client.send(payload);
      }
    }
  });

  awareness.on('update', ({ added, updated, removed }, origin) => {
    const changed = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
    );
    const payload = encoding.toUint8Array(encoder);
    for (const client of entry.cons) {
      if (client !== origin && client.readyState === 1) {
        client.send(payload);
      }
    }
  });

  return entry;
};

/**
 * @param {import('ws').WebSocket} ws
 * @param {string} roomId
 */
const bindYjsSocket = (ws, roomId) => {
  const entry = getOrCreate(roomId);
  entry.cons.add(ws);
  ws.binaryType = 'arraybuffer';
  ws.yjsRoomId = roomId;
  ws.isYjs = true;

  const send = (uint8) => {
    if (ws.readyState === 1) ws.send(uint8);
  };

  // Sync step 1 to new client
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, entry.doc);
    send(encoding.toUint8Array(encoder));
  }

  // Awareness snapshot
  const states = Array.from(entry.awareness.getStates().keys());
  if (states.length > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, states)
    );
    send(encoding.toUint8Array(encoder));
  }

  ws.on('message', (data) => {
    try {
      const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
      const decoder = decoding.createDecoder(buf);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, entry.doc, ws);
          if (encoding.length(encoder) > 1) {
            send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          awarenessProtocol.applyAwarenessUpdate(
            entry.awareness,
            decoding.readVarUint8Array(decoder),
            ws
          );
          break;
        }
        default:
          break;
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.on('close', () => {
    entry.cons.delete(ws);
    if (entry.cons.size === 0) {
      entry.doc.destroy();
      docs.delete(roomId);
    }
  });
};

module.exports = { bindYjsSocket, getOrCreate, docs };
