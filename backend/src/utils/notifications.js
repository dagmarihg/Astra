let io = null;

function setIO(_io) {
  io = _io;
}

function emitToAdmins(event, payload) {
  try {
    if (!io) return;
    // Emit to a namespace/room for admins; clients should join 'admins' room on connect
    io.to('admins').emit(event, payload);
  } catch (err) {
    console.error('[NOTIFICATIONS_ERROR]', err.message);
  }
}

module.exports = { setIO, emitToAdmins };
