var left = function(square) {return Square(square.i, square.j - 1)};
var up = function(square) {return Square(square.i - 1, square.j)};
var right = function(square) {return Square(square.i, square.j + 1)};
var down = function(square) {return Square(square.i + 1, square.j)};
var moves = {37: left, 38: up, 39: right, 40: down};
var isAccrossKey = {37: true, 38: false, 39: true, 40: false};
var moveOnBlack = false;

var uid;
var state;
var socket;
var canvas;
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
    $('#loader').addClass('hidden');
    response = JSON.parse(message);
    if (response == 'not found') {
      window.location.hash = '';
    } else {
      setPuzzle(response);
    }
  });

  socket.on('join', function(message) {
    var update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid) {
      myPos = {uid: uid, pid: puzzle.pid, i: state.square.i,
               j: state.square.j, isAccross: state.isAccross};
      socket.emit('set_cursor', JSON.stringify(myPos));
      setCursor(Square(0, 0), true, update.uid);
    }
  });

  socket.on('set_board', function(message) {
    var update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid) {
      setBoard(Square(update.i, update.j), update.val, update.uid);
    }
  });

  socket.on('set_cursor', function(message) {
    var update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid && update.uid != uid) {
      setCursor(Square(update.i, update.j), update.isAccross, update.uid);
    }
  });

  socket.on('leave', function(message) {
    var update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid &&
        state.others.hasOwnProperty(update.uid)) {
      var other = state.others[update.uid];
      drawCursor(other.square, other.isAccross, true, update.uid);
      delete state.others[update.uid];
    }
  });

  socket.on('disconnect', function() {
    $('#status').html('Disconnected. The server is probably down.');
    $('#status').removeClass('waiting connected');
    $('#status').addClass('disconnected');
  });

  canvas = $('#board')[0].getContext('2d');
  readPIDFromHash();
  $(window).bind('hashchange', function() {
    readPIDFromHash();
  });
});

$(window).bind('beforeunload', function() {
  socket.emit('leave');
  socket.disconnect();
});

function readPIDFromHash() {
  var param = window.location.hash;
  if (param.length > 1) {
    request = {uid: uid, pid: param.slice(1)};
    socket.emit('get_puzzle', JSON.stringify(request));
    $('#board-outer-wrapper').addClass('hidden');
    $('#upload-form-div').addClass('hidden');
    $('#loader').removeClass('hidden');
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
    socket.emit('leave');
    return;
  }

  state = {square: Square(0, 0), isAccross: true,
           accross: {}, down: {}, others: {},
           isLocal: [], squareClass: []};

  $('#board-outer-wrapper').removeClass('hidden');
  $('#upload-form-div').addClass('hidden');
  $('#title').html(puzzle.title);
  $('#author').html('by ' + puzzle.author);
  $('#board').width(28*puzzle.width);
  $('#board').height(28*puzzle.height);
  $('#board')[0].width = 28*puzzle.width;
  $('#board')[0].height = 28*puzzle.height;
  for (var i = 0; i < puzzle.height; i++) {
    state.isLocal.push([]);
    state.squareClass.push([]);
    for (var j = 0; j < puzzle.width; j++) {
      state.isLocal[i].push(true);
      state.squareClass[i].push([]);
      drawSquare(i, j);
    }
  }
  buildCluesList(puzzle.accross, 'accross');
  buildCluesList(puzzle.down, 'down');

  // Update the current state and set input handlers.
  setCursor(Square(0, 0), true);
  setInputHandlers();
}

function setSquareColor(i, j) {
  var isBlack = (puzzle.board[i][j] == '.');
  canvas.fillStyle = (isBlack ? 'black' : 'white');
  canvas.strokeStyle = 'black';
  for (var k = 0; k < state.squareClass[i][j].length; k++) {
    var cls = state.squareClass[i][j][k];
    if (cls == 'cursor') {
      canvas.fillStyle = (isBlack ? '#AA0000' : '#FF6666');
      canvas.strokeStyle = (isBlack ? '#440000' : '#880000');
      return;
    } else if (cls == 'highlight') {
      canvas.fillStyle = '#FFAAAA';
      canvas.strokeStyle = 'red';
      return;
    } else if (cls == 'other-cursor') {
      canvas.fillStyle = (isBlack ? '#222222' : '#999999');
      canvas.strokeStyle = (isBlack ? 'black' : '#444444');
    } else if (cls == 'other-highlight') {
      canvas.fillStyle = '#C4C4C4';
      canvas.strokeStyle = '#666666';
    }
  }
}

function drawSquare(i, j) {
  setSquareColor(i, j);
  canvas.fillRect(28*j, 28*i, 28, 28);
  canvas.strokeRect(28*j + 0.5, 28*i + 0.5, 27, 27);

  canvas.fillStyle = 'black';
  canvas.textBaseline = 'top';

  if (puzzle.annotation[i][j] != '') {
    canvas.font = '7.5pt serif';
    canvas.textAlign = 'left';
    canvas.fillText('' + puzzle.annotation[i][j], 28*j + 2, 28*i - 0.5);
  }

  if (puzzle.board[i][j] != '.' && puzzle.board[i][j] != '-') {
    canvas.font = '16pt serif';
    canvas.textAlign = 'center';
    canvas.fillText(puzzle.board[i][j], 28*j + 15.5, 28*i + 6.5);
  }
}

function buildCluesList(cluesDict, type) {
  var height = $('#board').height()/2 - 19;
  var keys = getKeys(cluesDict);
  var source = [];
  for (var i = 0; i < keys.length; i++) {
    source.push({html: buildClue(keys[i], cluesDict[keys[i]]), value: keys[i]});
  }
  $('#' + type).jqxListBox({source: source, theme: 'starcrossed',
                               width: 264, height: height});
  state[type].keys = keys;
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
  result.draw = function() {
    drawSquare(this.i, this.j);
  }
  result.addClass = function(cls) {
    state.squareClass[i][j].push(cls);
    this.draw();
  }
  result.removeClass = function(cls) {
    var index = state.squareClass[i][j].indexOf(cls);
    if (index >= 0) {
      state.squareClass[i][j][index] =
          state.squareClass[i][j][state.squareClass[i][j].length - 1];
      state.squareClass[i][j].pop();
    }
    this.draw();
  }
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
  if (other) {
    if (other == uid && state.isLocal[square.i][square.j]) {
      return;
    }
    state.isLocal[square.i][square.j] = false;
  } else {
    state.isLocal[square.i][square.j] = true;
  }

  if (puzzle.board[square.i][square.j] != val) {
    puzzle.board[square.i][square.j] = val;
    square.draw();
  }

  if (!other) {
    update = {uid: uid, pid: puzzle.pid, i: square.i,
              j: square.j, val: val};
    socket.emit('set_board', JSON.stringify(update));
  }
}

function setCursor(square, isAccross, other) {
  if (other) {
    // Doing a remote update. Simply draw the cursor.
    if (state.others.hasOwnProperty(other)) {
      drawCursor(state.others[other].square,
                 state.others[other].isAccross, true, other);
    }
    state.others[other] = {square: square, isAccross: isAccross};
    drawCursor(square, isAccross, false, other);
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
      highlights[i].removeClass(highlightClass);
    }
    cursor.removeClass(cursorClass);
  } else {
    for (var i = 0; i < highlights.length; i++) {
      highlights[i].addClass(highlightClass);
    }
    cursor.addClass(cursorClass);
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
      var element = $($(id).jqxListBox('getSelectedItem').element);
      if (i == 0) {
        element.removeClass('inactive-clue');
      } else {
        $(id).jqxListBox('clearSelection');
        element.addClass('inactive-clue');
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
    } else if (event.which == 32 || event.which == 46) {
      typeAndMove('-', (state.isAccross ? right : down));
    } else if (event.which == 9) {
      var type = (state.isAccross ? 'accross' : 'down');
      var index = $('#' + type).jqxListBox('selectedIndex');
      if (event.shiftKey) {
        if (index > 0) {
          $('#' + type).jqxListBox('selectIndex', index - 1);
        }
      } else {
        if (index < state[type].keys.length - 1) {
          $('#' + type).jqxListBox('selectIndex', index + 1);
        }
      }
      event.preventDefault();
    }
  });

  $('#board').mousedown(function(event) {
    var square = Square(Math.floor(event.offsetY/28),
                        Math.floor(event.offsetX/28));
    if (square.inRange) {
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
