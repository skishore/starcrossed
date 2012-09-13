var express = require('express');
var fs = require('fs');
var http = require('http');
var sio = require('socket.io');

var puzzles = {};

var app = express();
app.configure(function() {
  app.use(express.static(__dirname + '/static'));
  app.use(express.bodyParser());
});
app.get('/', function(req, res) {
  res.render('index');
});
app.post('/upload', function(req, res) {
  var uid = req.body.uid;
  var puz_file = req.files.puz;
  console.log('Received puzzle data from user %s', uid);
  if (puz_file.size && puz_file.size < (1 << 20)) {
    fs.readFile(puz_file.path, function(err, data) {
      if (err) {
        console.error('Could not open file: %s', err);
      } else {
        var pid = Math.floor((1 << 30)*Math.random());
        var puzzle = parse_puzzle_data(data);
        puzzle.pid = pid;
        puzzles[pid] = puzzle;
        var message = JSON.stringify({uid: uid, pid: pid});
        io.sockets.emit('pid', message);
        console.log('Created puzzle ' + pid);
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

// Parses a .puz file's data and returns a puzzle object. This object has
// a title, author, height, width, an annotated board, and accross and down
// clue dictionaries mapping clue number to clue.
function parse_puzzle_data(data) {
  var puzzle = {}
  puzzle.width = data[0x2C];
  puzzle.height = data[0x2D];
  // Parse the board from the data.
  var size = puzzle.height*puzzle.width;
  var board_str = data.slice(0x34 + size, 0x34 + 2*size).toString('ascii');
  puzzle.board = []
  puzzle.annotation = []
  for (var i = 0; i < puzzle.height; i++) {
    puzzle.board.push([]);
    puzzle.annotation.push([]);
    for (var j = 0; j < puzzle.width; j++) {
      puzzle.board[i].push(board_str[i*puzzle.width + j]);
      puzzle.annotation[i].push('');
    }
  }
  // Parse the title, author, and copyright strings.
  var parser = StringParser(data, 0x34 + 2*size);
  puzzle.title = parser.next();
  puzzle.author = parser.next();
  parser.next();
  // Annotate the board and build the accross and down clue dictionaries.
  puzzle.accross = {}
  puzzle.down = {}
  var clue = 1;
  for (i = 0; i < puzzle.height; i++) {
    for (j = 0; j < puzzle.width; j++) {
      if (is_accross_clue(puzzle.board, i, j)) {
        puzzle.annotation[i][j] = clue;
        puzzle.accross[clue] = parser.next();
        if (is_down_clue(puzzle.board, i, j)) {
          puzzle.down[clue] = parser.next();
        }
        clue++;
      } else if (is_down_clue(puzzle.board, i, j)) {
        puzzle.annotation[i][j] = clue;
        puzzle.down[clue] = parser.next();
        clue++;
      }
    }
  }
  return puzzle;
}

function is_accross_clue(board, row, col) {
  if (board[row][col] == '.') {
    return false;
  }
  return (col == 0 || board[row][col - 1] == '.') &&
         (col + 1 < board[0].length && board[row][col + 1] != '.');
}

function is_down_clue(board, row, col) {
  if (board[row][col] == '.') {
    return false;
  }
  return (row == 0 || board[row - 1][col] == '.') &&
         (row + 1 < board.length && board[row + 1][col] != '.');
}

// Takes a buffer and an offset into it. Each time next() is called, returns
// the next null-terminated string in the buffer.
function StringParser(buffer, offset) {
  if (offset == undefined) {
    offset = 0;
  }
  var result = {};
  result.buffer = buffer;
  result.offset = offset;
  result.next = function() {
    var old_offset = this.offset;
    while (this.offset < this.buffer.length &&
           this.buffer[this.offset] != 0x00) {
      this.offset++;
    }
    var str = this.buffer.slice(old_offset, this.offset).toString('ascii');
    this.offset = Math.min(this.offset + 1, this.buffer.length);
    return str;
  }
  return result;
}

var io = sio.listen(web_server, {log: false})
var nicknames = {};
io.sockets.on('connection', function (socket) {
  socket.on('get_puzzle', function(message) {
    var request = JSON.parse(message);
    socket.uid = request.uid;
    if (puzzles.hasOwnProperty(request.pid)) {
      socket.pid = request.pid;
      socket.emit('get_puzzle', JSON.stringify(puzzles[request.pid]));
    } else {
      socket.emit('get_puzzle', JSON.stringify('not found'));
    }
  });

  socket.on('set_board', function(message) {
    var update = JSON.parse(message);
    if (puzzles.hasOwnProperty(update.pid)) {
      puzzles[update.pid].board[update.i][update.j] = update.val;
      socket.broadcast.emit('set_board', message);
    }
  });

  socket.on('set_cursor', function(message) {
    socket.broadcast.emit('set_cursor', message);
  });

  socket.on('disconnect', function() {
    if (socket.hasOwnProperty('uid') && socket.hasOwnProperty('pid')) {
      //console.log('User ' + socket.uid +
      //            ' disconnected from puzzle ' + socket.pid);
      update = {uid: socket.uid, pid: socket.pid};
      socket.broadcast.emit('lost_user', JSON.stringify(update));
    }
  });
});
