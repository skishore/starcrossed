var keys = {37: 'left', 38: 'up', 39: 'right', 40: 'down'};
var isAccrossKey = {37: true, 38: false, 39: true, 40: false};
var moves = {left: function(square) {return Square(square.i, square.j - 1)},
             up: function(square) {return Square(square.i - 1, square.j)},
             right: function(square) {return Square(square.i, square.j + 1)},
             down: function(square) {return Square(square.i + 1, square.j)}};
var squareRegex = /^square([0-9]*)-([0-9]*)$/;

var uid;
var state;
var socket;
var pid;
var puzzle;

$(document).ready(function() {
  uid = Math.floor((1 << 30)*Math.random());
  state = {square: Square(0, 0), isAccross: true};
  $('#uid-text').val(uid);
  socket = io.connect();

  socket.on('connect', function() {
    $('#status').html('Connected!');
    $('#status').removeClass('waiting disconnected');
    $('#status').addClass('connected');
  });

  socket.on('pid', function(message) {
    var result = JSON.parse(message);
    if (result.uid == uid) {
      window.location.hash = result.pid;
    }
  });

  socket.on('get_puzzle', function(message) {
    puzzle = JSON.parse(message);
    updatePuzzle(puzzle);
  });

  socket.on('disconnect', function() {
    $('#status').html('Disconnected. The server is probably down.');
    $('#status').removeClass('waiting connected');
    $('#status').addClass('disconnected');
  });

  readPIDFromHash();
  $(window).bind('hashchange', function() {
    readPIDFromHash();
  });
});

function readPIDFromHash() {
  var param = window.location.hash;
  if (param.length > 1) {
    pid = param.slice(1);
    socket.emit('get_puzzle', pid);
  } else {
    pid = undefined;
    puzzle = undefined;
    updatePuzzle(puzzle);
  }
}

/* ----------------------------------------------------
// Graphics code begins here!
---------------------------------------------------- */

function updatePuzzle(puzzle) {
  if (puzzle == undefined) {
    $('#board-outer-wrapper').addClass('hidden');
    $('#upload-form-div').removeClass('hidden');
    return;
  }
  $('#board-outer-wrapper').removeClass('hidden');
  $('#upload-form-div').addClass('hidden');
  $('#title').html(puzzle.title);
  $('#author').html('by ' + puzzle.author);
  $('#board').html('');
  board_html = '';
  for (var i = 0; i < puzzle.height; i++) {
    for (var j = 0; j < puzzle.width; j++) {
      board_html += buildSquare(puzzle, i, j);
    }
    if (i + 1 < puzzle.height) {
      board_html += '<br>';
    }
  }
  $('#board').html(board_html);
  buildCluesList(puzzle.accross, 'accross');
  buildCluesList(puzzle.down, 'down');

  // Update the current state and set input handlers.
  setCursor(Square(0, 0), true);
  setInputHandlers();
}

function buildSquare(puzzle, i, j) {
  var square_class = 'white square';
  var square_number = '&nbsp';
  var contents = '';
  if (puzzle.board[i][j] == '.') {
    square_class = 'black square';
  } else {
    if (puzzle.annotation[i][j] != '') {
      square_number = '' + puzzle.annotation[i][j];
    }
    if (puzzle.board[i][j] != '-') {
      contents = puzzle.board[i][j];
    }
  }
  var id = '' + i + '-' + j;
  var inner_html = ('<p class="number">' + square_number + '</p>' +
                    '<p id="contents' + id + '" class="contents">' +
                    contents + '</p>');
  return ('<div id="square' + id + '" class="' + square_class + '">' +
          inner_html + '</div>');
}

function buildCluesList(cluesDict, listDiv) {
  var height = $('#board').height()/2 - 19;
  var keys = getKeys(cluesDict);
  var source = [];
  for (var i = 0; i < keys.length; i++) {
    source.push({html: buildClue(keys[i], cluesDict[keys[i]]), value: keys[i]});
  }
  $('#' + listDiv).jqxListBox({source: source, theme: 'starcrossed',
                               width: 264, height: height});
}

function getKeys(dict) {
  var keys = [];
  for (var key in dict) {
    if (dict.hasOwnProperty(key)) {
      keys.push(key);
    }
  }
  keys.sort(function(a, b) {return a - b;});
  return keys;
}

function buildClue(num, clue) {
  return ('<div><span class="clue-number">' + num + '.</span>' +
          '<div class="clue">' + clue  + '</div></div>');
}

/* ----------------------------------------------------
// Game code begins here!
---------------------------------------------------- */

function Square(i, j) {
  var result = {i: i, j: j}
  result.inRange = (puzzle != undefined &&
                    i >= 0 && i < puzzle.height &&
                    j >= 0 && j < puzzle.width);
  result.div = $('#square' + i + '-' + j);
  return result;
}

// The input square should be in range.
function annotation(square) {
  return puzzle.board[square.i][square.j];
}

// The input square should be in range.
function board(square, val) {
  if (val == undefined) {
    return puzzle.board[square.i][square.j];
  }
  puzzle.board[square.i][square.j] = val;
}

// The input square should be in range.
function clueSquares(square, isAccross) {
  if (board(square) == '.') {
    return [];
  }
  var directions = (isAccross ? ['left', 'right'] : ['up', 'down'])
  var results = []
  var square = moves[directions[0]](square);
  while (square.inRange && board(square) != '.') {
    results.push(square);
    square = moves[directions[0]](square);
  }
  square = moves[directions[1]](square);
  while (square.inRange && board(square) != '.') {
    results.push(square);
    square = moves[directions[1]](square);
  }
  return results;
}

function setCursor(square, isAccross) {
  drawCursor(state.square, state.isAccross, true);
  if (state.isAccross != isAccross) {
    state.isAccross = isAccross;
  } else if (square.inRange) {
    state.square = square;
  }
  drawCursor(state.square, state.isAccross, false);
}

function drawCursor(cursor, isAccross, erase) {
  highlights = clueSquares(cursor, isAccross);
  if (erase) {
    for (var i = 0; i < highlights.length; i++) {
      highlights[i].div.removeClass('cursor highlight');
    }
    cursor.div.removeClass('cursor highlight');
  } else {
    for (var i = 0; i < highlights.length; i++) {
      highlights[i].div.addClass('highlight');
    }
    cursor.div.addClass('cursor');
  }
}

function setInputHandlers() {
  $('#board').keydown(function(event) {
    if (keys.hasOwnProperty(event.which)) {
      setCursor(moves[keys[event.which]](state.square),
                isAccrossKey[event.which]);
      event.preventDefault();
    }
  });

  $('#board').mousedown(function(event) {
    var target = squareRegex.exec(event.target.id);
    if (target != null) {
      var square = Square(parseInt(target[1]), parseInt(target[2]))
      if (square.i != state.square.i || square.j != state.square.j) {
        setCursor(square, state.isAccross);
      } else {
        setCursor(state.square, !state.isAccross);
      }
    }
    event.preventDefault();
    $('#board').focus();
  });
}
