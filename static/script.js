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

function updatePuzzle(value) {
  puzzle = value;
  if (puzzle == undefined) {
    return;
  }
  $('#board').html('');

  board_html = '';
  for (var i = 0; i < puzzle.height; i++) {
    for (var j = 0; j < puzzle.width; j++) {
      board_html += getSquare(puzzle, i, j);
    }
    if (i + 1 < puzzle.height) {
      board_html += '<br>';
    }
  }
  $('#board').html(board_html);
}

function getSquare(puzzle, i, j) {
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
