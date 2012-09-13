var left = function(square) {return Square(square.i, square.j - 1)};
var up = function(square) {return Square(square.i - 1, square.j)};
var right = function(square) {return Square(square.i, square.j + 1)};
var down = function(square) {return Square(square.i + 1, square.j)};
var moves = {37: left, 38: up, 39: right, 40: down};
var isAccrossKey = {37: true, 38: false, 39: true, 40: false};
var squareRegex = /^square([0-9]*)-([0-9]*)$/;
var moveOnBlack = false;

var uid;
var state;
var socket;
var puzzle;
var lock = true;

$(document).ready(function() {
  uid = Math.floor((1 << 30)*Math.random());
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
    response = JSON.parse(message);
    if (response == 'not found') {
      window.location.hash = '';
    } else {
      setPuzzle(response);
    }
  });

  socket.on('set_board', function(message) {
    update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid) {
      setBoard(Square(update.i, update.j), update.val, true);
    }
  });

  socket.on('set_cursor', function(message) {
    update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid && update.uid != uid) {
      setCursor(Square(update.i, update.j), update.isAccross, update.uid);
    }
  });

  socket.on('lost_user', function(message) {
    update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid &&
        state.others.hasOwnProperty(update.uid)) {
      var other = state.others[update.uid];
      drawCursor(other.square, other.isAccross, true, true);
    }
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
    request = {uid: uid, pid: param.slice(1)};
    socket.emit('get_puzzle', JSON.stringify(request));
  } else {
    setPuzzle(undefined);
  }
}

/* ----------------------------------------------------
// Graphics code begins here!
---------------------------------------------------- */

function setPuzzle(new_puzzle) {
  puzzle = new_puzzle;
  if (!puzzle) {
    $('#board-outer-wrapper').addClass('hidden');
    $('#upload-form-div').removeClass('hidden');
    clearInputHandlers();
    return;
  }

  state = {square: Square(0, 0), isAccross: true,
           accross: {}, down: {}, others: {}};

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
  state[listDiv].keys = keys;
}

// Only works if the dictionary is keyed by integers or integral strings.
function getKeys(dict) {
  var keys = [];
  for (var key in dict) {
    if (dict.hasOwnProperty(key)) {
      keys.push(parseInt(key));
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
  result.inRange = (puzzle && i >= 0 && i < puzzle.height &&
                    j >= 0 && j < puzzle.width);
  result.div = $('#square' + i + '-' + j);
  return result;
}

// The input square should be in range.
function annotation(square) {
  return puzzle.annotation[square.i][square.j];
}

// The input square should be in range.
function board(square) {
  return puzzle.board[square.i][square.j];
}

// The input square should be in range.
function clueSquares(cursor, isAccross) {
  if (board(cursor) == '.') {
    return [];
  }
  var moves = (isAccross ? [left, right] : [up, down])
  var results = []
  var square = moves[0](cursor);
  while (square.inRange && board(square) != '.') {
    results.push(square);
    square = moves[0](square);
  }
  square = moves[1](cursor);
  while (square.inRange && board(square) != '.') {
    results.push(square);
    square = moves[1](square);
  }
  return results;
}

// The input square should be in range.
function whichClues(cursor, isAccross) {
  var moves = (isAccross ? [left, up] : [up, left]);
  var results = [];
  for (var i = 0; i < 2; i++) {
    var square = cursor;
    var last = '';
    while (square.inRange && board(square) != '.') {
      last = annotation(square);
      square = moves[i](square);
    }
    if (last == '') {
      results.push(null);
    } else {
      results.push([last, (moves[i] == left ? 'accross' : 'down')]);
    }
  }
  return results;
}

// Returns the square at which the clue is found.
function findClueByNumber(clueNumber) {
  for (var i = 0; i < puzzle.height; i++) {
    for (var j = 0; j < puzzle.height; j++) {
      if (puzzle.annotation[i][j] == clueNumber) {
        return Square(i, j);
      }
    }
  }
  return null;
}

function setBoard(square, val, other) {
  if (puzzle.board[square.i][square.j] != val) {
    puzzle.board[square.i][square.j] = val;
    if (val == '-') {
      $('#contents' + square.i + '-' + square.j).html('');
    } else {
      $('#contents' + square.i + '-' + square.j).html(val);
    }
  }

  if (!other) {
    update = {pid: puzzle.pid, i: square.i, j: square.j, val: val};
    socket.emit('set_board', JSON.stringify(update));
  }
}

function setCursor(square, isAccross, other) {
  if (other) {
    // Doing a remote update. Simply draw the cursor.
    if (state.others.hasOwnProperty(other)) {
      drawCursor(state.others[other].square,
                 state.others[other].isAccross, true, true);
    }
    state.others[other] = {square: square, isAccross: isAccross};
    drawCursor(square, isAccross, false, true);
  } else if (lock) {
    // Doing a local cursor position update. Pick up the semaphore
    // to avoid a cascade of update -> select clues -> update...
    lock = false;
    drawCursor(state.square, state.isAccross, true);
    state.isAccross = isAccross;
    if (square.inRange) {
      state.square = square;
    }
    drawCursor(state.square, state.isAccross, false);
    drawCurrentClues(whichClues(state.square, state.isAccross));
    lock = true;

    update = {uid: uid, pid: puzzle.pid, i: square.i,
              j: square.j, isAccross: isAccross};
    socket.emit('set_cursor', JSON.stringify(update));
  }
}

function drawCursor(cursor, isAccross, erase, other) {
  var cursorClass = (other ? 'other-cursor' : 'cursor');
  var highlightClass = (other ? 'other-highlight' : 'highlight');
  highlights = clueSquares(cursor, isAccross);
  if (erase) {
    for (var i = 0; i < highlights.length; i++) {
      highlights[i].div.removeClass(cursorClass + ' ' + highlightClass);
    }
    cursor.div.removeClass(cursorClass + ' ' + highlightClass);
  } else {
    for (var i = 0; i < highlights.length; i++) {
      highlights[i].div.addClass(highlightClass);
    }
    cursor.div.addClass(cursorClass);
  }
}

function drawCurrentClues(clues) {
  for (var i = 0; i < 2; i++) {
    var clue = clues[i];
    if (clue != null) {
      var index = state[clue[1]].keys.indexOf(clue[0]);
      var id = '#' + clue[1];
      $(id).jqxListBox('selectIndex', index);
      $(id).jqxListBox('ensureVisible', index);
      if (i == 0) {
        $($(id).jqxListBox('getSelectedItem').element).removeClass('inactive-clue');
      } else {
        $($(id).jqxListBox('getSelectedItem').element).addClass('inactive-clue');
      }
    }
  }
}

function oldMoveCursor(move, isAccross) {
  if (isAccross != state.isAccross) {
    setCursor(state.square, isAccross);
  } else {
    setCursor(move(state.square), state.isAccross);
  }
}

function newMoveCursor(move, isAccross) {
  if (isAccross != state.isAccross) {
    setCursor(state.square, isAccross);
  } else {
    var square = move(state.square);
    while (square.inRange && board(square) == '.') {
      square = move(square);
    }
    if (square.inRange) {
      setCursor(square, state.isAccross);
    }
  }
}

function typeAndMove(val, move) {
  if (board(state.square) != '.') {
    setBoard(state.square, val);
    var square = move(state.square);
    if (square.inRange && board(square) != '.') {
      setCursor(square, state.isAccross);
    }
  }
}

function setInputHandlers() {
  clearInputHandlers();

  $('#accross').bind('select', function(event) {
    if (event.args && event.args.item) {
      var square = findClueByNumber(event.args.item.value);
      if (square != null) {
        setCursor(square, true);
      }
    }
    $('#board').focus();
  });

  $('#down').bind('select', function(event) {
    if (event.args && event.args.item) {
      var square = findClueByNumber(event.args.item.value);
      if (square != null) {
        setCursor(square, false);
      }
    }
    $('#board').focus();
  });

  $('#board').keydown(function(event) {
    if (moves.hasOwnProperty(event.which)) {
      var moveCursor = (moveOnBlack ? oldMoveCursor : newMoveCursor);
      moveCursor(moves[event.which], isAccrossKey[event.which]);
      event.preventDefault();
    } else if (event.which >= 65 && event.which < 91) {
      var letter = String.fromCharCode(event.which);
      typeAndMove(letter, (state.isAccross ? right : down));
    } else if (event.which == 8) {
      typeAndMove('-', (state.isAccross ? left : up));
      event.preventDefault();
    }
  });

  $('#board').mousedown(function(event) {
    var target = squareRegex.exec(event.target.id);
    if (target != null) {
      var square = Square(parseInt(target[1]), parseInt(target[2]))
      if (square.i != state.square.i || square.j != state.square.j) {
        if (moveOnBlack || (square.inRange && board(square) != '.')) {
          setCursor(square, state.isAccross);
        }
      } else {
        setCursor(state.square, !state.isAccross);
      }
    }
    event.preventDefault();
    $('#board').focus();
  });

  $('#board').focus();
}

function clearInputHandlers() {
  $('#accross').unbind('select');
  $('#down').unbind('select');
  $('#board').unbind('keydown');
  $('#board').unbind('mousedown');
}
