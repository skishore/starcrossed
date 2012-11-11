var left = function(square) {return Square(square.i, square.j - 1)};
var up = function(square) {return Square(square.i - 1, square.j)};
var right = function(square) {return Square(square.i, square.j + 1)};
var down = function(square) {return Square(square.i + 1, square.j)};
var moves = {37: left, 38: up, 39: right, 40: down};
var isAcrossKey = {37: true, 38: false, 39: true, 40: false};
var squareRegex = /^square([0-9]*)-([0-9]*)$/;

var uid;
var socket;
var puzzle;
var locked = false;

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
      //myPos = {uid: uid, pid: puzzle.pid, i: state.square.i,
      //         j: state.square.j, isAcross: state.isAcross};
      //socket.emit('set_cursor', JSON.stringify(myPos));
      //setCursor(Square(0, 0), true, update.uid);
    }
  });

  socket.on('board_state', function(message) {
    var update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid) {
      for (var i = 0; i < puzzle.height; i++) {
        for (var j = 0; j < puzzle.width; j++) {
          if (update.version[i][j] > puzzle.version[i][j] ||
              (update.version[i][j] == puzzle.version[i][j] &&
               update.board[i][j] != puzzle.board[i][j])) {
            setBoard(Square(i, j), update.board[i][j], false);
            puzzle.version[i][j] = update.version[i][j];
          }
        }
      }
    }
  });

  socket.on('set_cursor', function(message) {
    var update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid && update.uid != uid) {
      setCursor(Square(update.i, update.j), update.isAcross, update.uid);
    }
  });

  socket.on('leave', function(message) {
    var update = JSON.parse(message);
    if (puzzle && update.pid == puzzle.pid &&
        puzzle.cursors.hasOwnProperty(update.uid)) {
      eraseCursor(update.uid);
      delete puzzle.cursors[update.uid];
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
  buildCluesList(puzzle.across, 'across');
  buildCluesList(puzzle.down, 'down');

  // Add the local cursor to the cursors list and set input handlers.
  puzzle.cursors[uid] = {
      square: Square(0, 0),
      isAcross: true,
  };
  setCursor(uid, Square(0, 0), true);
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

function buildCluesList(cluesDict, type) {
  var height = $('#board').height()/2 - 19;
  var keys = getKeys(cluesDict);
  var source = [];
  for (var i = 0; i < keys.length; i++) {
    source.push({html: buildClue(keys[i], cluesDict[keys[i]]), value: keys[i]});
  }
  $('#' + type).jqxListBox({source: source, theme: 'starcrossed',
                               width: 264, height: height});
  puzzle[type + '_keys'] = keys;
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
  return {
      i: i,
      j: j,
      inRange: (puzzle &&
                i >= 0 && i < puzzle.height &&
                j >= 0 && j < puzzle.width),
  };
}

function div(square) {
  return $('#square' + square.i + '-' + square.j);
}

// The input square should be in range.
function annotation(square) {
  return puzzle.annotation[square.i][square.j];
}

// The input square should be in range.
function board(square) {
  return puzzle.board[square.i][square.j];
}

// The input cursor's square should be in range.
function clueSquares(cursor) {
  if (board(cursor.square) == '.') {
    return [];
  }
  var moves = (cursor.isAcross ? [left, right] : [up, down])
  var results = []
  var square = moves[0](cursor.square);
  while (square.inRange && board(square) != '.') {
    results.push(square);
    square = moves[0](square);
  }
  square = moves[1](cursor.square);
  while (square.inRange && board(square) != '.') {
    results.push(square);
    square = moves[1](square);
  }
  return results;
}

// The input cursor's square should be in range.
function whichClues(cursor) {
  var moves = (cursor.isAcross ? [left, up] : [up, left]);
  var results = [];
  for (var i = 0; i < 2; i++) {
    var square = cursor.square;
    var last = '';
    while (square.inRange && board(square) != '.') {
      last = annotation(square);
      square = moves[i](square);
    }
    if (last == '') {
      results.push(null);
    } else {
      results.push([last, (moves[i] == left ? 'across' : 'down')]);
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

function setBoard(square, val, local) {
  if (puzzle.board[square.i][square.j] != val) {
    puzzle.board[square.i][square.j] = val;
    if (val == '-') {
      $('#contents' + square.i + '-' + square.j).html('');
    } else {
      $('#contents' + square.i + '-' + square.j).html(val);
    }
  }

  if (local) {
    update = {uid: uid, pid: puzzle.pid, i: square.i,
              j: square.j, val: val};
    socket.emit('set_board', JSON.stringify(update));
  }
}

function setCursor(cid, square, isAcross) {
  if (cid != uid || !locked) {
    if (puzzle.cursors.hasOwnProperty(cid)) {
      eraseCursor(cid);
    }
    puzzle.cursors[cid] = {
        square: square,
        isAcross: isAcross,
    };
    drawCursor(cid);

    if (cid == uid) {
      // Prevent updating the current clues from moving the cursor.
      locked = true;
      drawCurrentClues(whichClues(puzzle.cursors[cid]));
      locked = false;
    }
  }
}

function drawCursor(cid, erase) {
  var local = (cid == uid);
  var cursor = puzzle.cursors[cid];
  var cursorClass = (local ? 'cursor' : 'other-cursor');
  var highlightClass = (local ? 'highlight' : 'other-highlight');
  highlights = clueSquares(cursor);
  if (erase) {
    for (var i = 0; i < highlights.length; i++) {
      div(highlights[i]).removeClass(cursorClass + ' ' + highlightClass);
    }
    div(cursor.square).removeClass(cursorClass + ' ' + highlightClass);
  } else {
    for (var i = 0; i < highlights.length; i++) {
      div(highlights[i]).addClass(highlightClass);
    }
    div(cursor.square).addClass(cursorClass);
  }

  if (erase && !local) {
    for (var i in puzzle.cursors) {
      if (i != uid && i != cid) {
        drawCursor(i, puzzle.cursors[i]);
      }
    }
  }
}

function eraseCursor(cid) {
  drawCursor(cid, true);
}

function drawCurrentClues(clues) {
  for (var i = 0; i < 2; i++) {
    var clue = clues[i];
    if (clue != null) {
      var index = puzzle[clue[1] + '_keys'].indexOf(clue[0]);
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

function moveCursor(move, isAcross) {
  var cursor = puzzle.cursors[uid];
  if (isAcross != cursor.isAcross) {
    setCursor(uid, cursor.square, isAcross);
  } else {
    var square = move(cursor.square);
    while (square.inRange && board(square) == '.') {
      square = move(square);
    }
    if (square.inRange) {
      setCursor(uid, square, cursor.isAcross);
    }
  }
}

function typeAndMove(val, move) {
  var cursor = puzzle.cursors[uid];
  if (board(cursor.square) != '.') {
    setBoard(cursor.square, val, true);
    puzzle.version[cursor.square.i][cursor.square.j] += 1;
    var square = move(cursor.square);
    if (square.inRange && board(square) != '.') {
      setCursor(uid, square, cursor.isAcross);
    }
  }
}

function setInputHandlers() {
  clearInputHandlers();

  $('#across').bind('select', function(event) {
    if (event.args && event.args.item) {
      var square = findClueByNumber(event.args.item.value);
      if (square != null) {
        setCursor(uid, square, true);
      }
    }
    $('#board').focus();
  });

  $('#down').bind('select', function(event) {
    if (event.args && event.args.item) {
      var square = findClueByNumber(event.args.item.value);
      if (square != null) {
        setCursor(uid, square, false);
      }
    }
    $('#board').focus();
  });

  $('#board').keydown(function(event) {
    var cursor = puzzle.cursors[uid];
    if (moves.hasOwnProperty(event.which)) {
      moveCursor(moves[event.which], isAcrossKey[event.which]);
      event.preventDefault();
    } else if (event.which >= 65 && event.which < 91) {
      var letter = String.fromCharCode(event.which);
      typeAndMove(letter, (cursor.isAcross ? right : down));
    } else if (event.which == 8) {
      typeAndMove('-', (cursor.isAcross ? left : up));
      event.preventDefault();
    } else if (event.which == 32 || event.which == 46) {
      typeAndMove('-', (cursor.isAcross ? right : down));
    } else if (event.which == 9) {
      var type = (cursor.isAcross ? 'across' : 'down');
      var index = $('#' + type).jqxListBox('selectedIndex');
      if (event.shiftKey) {
        if (index > 0) {
          $('#' + type).jqxListBox('selectIndex', index - 1);
        }
      } else {
        if (index < puzzle[type + '_keys'].length - 1) {
          $('#' + type).jqxListBox('selectIndex', index + 1);
        }
      }
      event.preventDefault();
    }
  });

  $('#board').mousedown(function(event) {
    var target = squareRegex.exec(event.target.id);
    if (target != null) {
      var cursor = puzzle.cursors[uid];
      var square = Square(parseInt(target[1]), parseInt(target[2]))
      if (square.i != cursor.square.i || square.j != cursor.square.j) {
        if (square.inRange && board(square) != '.') {
          setCursor(uid, square, cursor.isAcross);
        }
      } else {
        setCursor(uid, cursor.square, !cursor.isAcross);
      }
    }
    event.preventDefault();
    $('#board').focus();
  });

  $('#board').focus();
}

function clearInputHandlers() {
  $('#across').unbind('select');
  $('#down').unbind('select');
  $('#board').unbind('keydown');
  $('#board').unbind('mousedown');
}
