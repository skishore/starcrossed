var http = require('http');
var express = require('express');
var sio = require('socket.io');

var app = express();
app.configure(function () {
  app.use(express.static(__dirname + '/static'));
});
app.get('/', function (req, res) {
  res.render('index');
});

web_server = http.createServer(app);
web_server.listen(3000, function () {
  var addr = web_server.address();
  console.log('Starcrossed server listening on',
              'http://' + addr.address + ':' + addr.port);
});

var io = sio.listen(web_server, {log: false})
var nicknames = {};
io.sockets.on('connection', function (socket) {
  socket.on('message', function(msg) {
    socket.broadcast.emit('message', socket.nickname, msg);
  });

  socket.on('nickname', function(nick, fn) {
    if (nicknames[nick]) {
      fn(true);
    } else {
      fn(false);
      nicknames[nick] = socket.nickname = nick;
      socket.broadcast.emit('announcement', nick + ' connected');
      io.sockets.emit('nicknames', nicknames);
    }
  });

  socket.on('disconnect', function() {
    if (!socket.nickname) return;

    delete nicknames[socket.nickname];
    socket.broadcast.emit('announcement', socket.nickname + ' disconnected');
    socket.broadcast.emit('nicknames', nicknames);
  });
});
