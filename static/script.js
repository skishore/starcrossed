var socket;

$(document).ready(function() {
  socket = io.connect();
  socket.on('connect', function() {
    console.debug('Socket connected');
  });
});
