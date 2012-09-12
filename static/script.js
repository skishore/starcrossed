var uid;
var pid;
var socket;

$(document).ready(function() {
  uid = Math.floor((1 << 30)*Math.random());
  $('#uid-text').val(uid);
  socket = io.connect();

  socket.on('connect', function() {
    console.debug('Socket connected');
  });

  socket.on('pid', function(message) {
    result = JSON.parse(message);
    console.debug(uid);
    console.debug(result);
  });
});
