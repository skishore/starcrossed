function queryServer(query, returnCall) {
  pingServer(query, 'query', returnCall);
}

function updateServer(update, returnCall) {
  pingServer(update, 'update', returnCall);
}

function pingServer(query, queryType, returnCall) {
  if (typeof(returnCall) == 'undefined') {
    returnCall = function() {};
  }
  var request = $.get;
  if (queryType == 'update') {
    request = $.post;
  }
  request(queryType, query, function(json) {
    autoParseJson(json);
    returnCall(json);
  }, 'xml');
}

function autoParseJson(json) {

}
