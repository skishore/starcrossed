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
// a title, author, height, width, an annotated board, and across and down
// clue dictionaries mapping clue number to clue.
function parse_puzzle_data(data) {
  var puzzle = {}
  puzzle.width = data[0x2C];
  puzzle.height = data[0x2D];
  // Parse the board from the data.
  var size = puzzle.height*puzzle.width;
  var board_str = data.slice(0x34 + size, 0x34 + 2*size).toString('ascii');
  puzzle.board = [];
  puzzle.annotation = [];
  puzzle.version = [];
  for (var i = 0; i < puzzle.height; i++) {
    puzzle.board.push([]);
    puzzle.annotation.push([]);
    puzzle.version.push([]);
    for (var j = 0; j < puzzle.width; j++) {
      puzzle.board[i].push(board_str[i*puzzle.width + j]);
      puzzle.annotation[i].push('');
      puzzle.version[i].push(0);
    }
  }
  // Parse the title, author, and copyright strings.
  var parser = StringParser(data, 0x34 + 2*size);
  puzzle.title = parser.next();
  puzzle.author = parser.next();
  parser.next();
  // Annotate the board and build the across and down clue dictionaries.
  puzzle.across = {}
  puzzle.down = {}
  var clue = 1;
  for (i = 0; i < puzzle.height; i++) {
    for (j = 0; j < puzzle.width; j++) {
      if (is_across_clue(puzzle.board, i, j)) {
        puzzle.annotation[i][j] = clue;
        puzzle.across[clue] = parser.next();
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
  puzzle.cursors = {};
  return puzzle;
}

function is_across_clue(board, row, col) {
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

var puzzle_members = {};

function broadcast_to_puzzle_members(pid, type, message) {
  if (puzzle_members.hasOwnProperty(pid)) {
    for (var uid in puzzle_members[pid]) {
      puzzle_members[pid][uid].emit(type, message);
    }
  }
}

function join(pid, socket) {
  if (socket.pid != pid && puzzles.hasOwnProperty(pid)) {
    socket.pid = pid;
    var message = JSON.stringify({pid: pid, uid: socket.uid});
    broadcast_to_puzzle_members(pid, 'join', message);
    if (!puzzle_members.hasOwnProperty(pid)) {
      puzzle_members[pid] = {};
    }
    puzzle_members[pid][socket.uid] = socket;
  }
  socket.old = false;
  if (puzzles.hasOwnProperty(pid)) {
    puzzles[pid].old = false;
  }
}

function leave(pid, socket) {
  if (socket.pid == pid && puzzles.hasOwnProperty(pid)) {
    if (puzzle_members.hasOwnProperty(pid) &&
        puzzle_members[pid].hasOwnProperty(socket.uid)) {
      delete puzzle_members[pid][socket.uid];
      if (Object.keys(puzzle_members[pid]).length == 0) {
        delete puzzle_members[pid];
      }
    }
    var message = JSON.stringify({pid: pid, uid: socket.uid});
    broadcast_to_puzzle_members(pid, 'leave', message);
    delete socket.pid;
  }
}

var io = sio.listen(web_server, {log: false})

io.sockets.on('connection', function (socket) {
  socket.on('get_puzzle', function(message) {
    var request = JSON.parse(message);
    socket.uid = request.uid;
    leave(socket.pid, socket);
    if (puzzles.hasOwnProperty(request.pid)) {
      socket.emit('get_puzzle', JSON.stringify(puzzles[request.pid]));
      join(request.pid, socket);
    } else {
      socket.emit('get_puzzle', JSON.stringify('not found'));
    }
  });

  socket.on('set_board', function(message) {
    var update = JSON.parse(message);
    join(update.pid, socket);
    if (puzzles.hasOwnProperty(update.pid)) {
      puzzles[update.pid].board[update.i][update.j] = update.val;
      puzzles[update.pid].version[update.i][update.j] += 1;
      var response = JSON.stringify({
          pid: update.pid,
          board: puzzles[update.pid].board,
          version: puzzles[update.pid].version,
        });
      broadcast_to_puzzle_members(update.pid, 'board_state', response);
    }
  });

  socket.on('set_cursor', function(message) {
    var update = JSON.parse(message);
    join(update.pid, socket);
    broadcast_to_puzzle_members(update.pid, 'set_cursor', message);
  });

  socket.on('leave', function() {
    if (socket.hasOwnProperty('uid') && socket.hasOwnProperty('pid')) {
      leave(socket.pid, socket);
    }
  });

  socket.on('disconnect', function() {
    if (socket.hasOwnProperty('uid') && socket.hasOwnProperty('pid')) {
      leave(socket.pid, socket);
    }
  });
});

function vacuum() {
  // Remove sockets that have not called join() in a while.
  for (var pid in puzzle_members) {
    for (var uid in puzzle_members[pid]) {
      var socket = puzzle_members[pid][uid];
      if (socket.old) {
        socket.disconnect();
      } else {
        socket.old = true;
      }
    }
  }

  // Remove puzzles that have had no members for a while.
  for (var pid in puzzles) {
    if (puzzles[pid].old && !puzzle_members.hasOwnProperty(pid)) {
      delete puzzles[pid];
    } else {
      puzzles[pid].old = true;
    }
  }
}
setInterval(vacuum, 3600*1000);
