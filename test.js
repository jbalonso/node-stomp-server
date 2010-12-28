var sys = require("sys"),
  stomp = require("./stomp");

var client = new stomp.Client("localhost", 61613);
client.subscribe("/queue/news", function(data){
  console.log('received: ' + JSON.stringify(data));
});
client.publish('/queue/news','hello');

var repl = require('repl').start( 'stomp-test> ' );
repl.context.client = client;
