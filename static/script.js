var uid;
var socket;
var pid;
var puzzle;

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
    updatePuzzle(JSON.parse(message));
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
    updatePuzzle(undefined);
  }
}

/* ----------------------------------------------------
// Graphics code begins here!
---------------------------------------------------- */

function updatePuzzle(value) {
  puzzle = value;
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
