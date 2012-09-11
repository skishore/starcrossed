var express = require('express');
var fs = require('fs');
var http = require('http');
var sio = require('socket.io');

var app = express();
app.configure(function() {
  app.use(express.static(__dirname + '/static'));
  app.use(express.bodyParser());
});
app.get('/', function(req, res) {
  res.render('index');
});
app.post('/upload', function(req, res) {
  var puz_file = req.files.puz;
  if (puz_file.size && puz_file.size < (1 << 20)) {
    fs.readFile(puz_file.path, function(err, data) {
      if (err) {
        console.error('Could not open file: %s', err);
      } else {
        puzzle = parse_puzzle_data(data);
        console.log(puzzle);
      }
    });
  } else if (puz_file.size) {
    console.log('Puzzle file was too large');
  } else {
    console.log('No file uploaded');
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Upload posted');
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

function parse_puzzle_data(data) {
  puzzle = {}
  puzzle.width = data[0x2C];
  puzzle.height = data[0x2D];
  return puzzle;
}
