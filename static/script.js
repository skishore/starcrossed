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
  board_html = '';
  $('#board').html('');
  for (var i = 0; i < puzzle.height; i++) {
    for (var j = 0; j < puzzle.width; j++) {
      var color = (puzzle.board[i][j] == '.' ? 'black' : 'white');
      var contents = '';
      if (puzzle.board[i][j] != '.' && puzzle.board[i][j] != '-') {
        contents = '<p>' + puzzle.board[i][j] + '</p>';
      }
      board_html += ('<div id="square' + i + '-' + j + '" class="' +
                     color + ' square">' + contents + '</div>');
    }
    if (i + 1 < puzzle.height) {
      board_html += '<br>';
    }
  }
  $('#board').html(board_html);
}

function readPIDFromHash() {
  var param = window.location.hash;
  if (param.length > 1) {
    pid = param.slice(1);
    socket.emit('get_puzzle', pid);
  }
}
