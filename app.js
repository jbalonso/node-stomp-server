
// Load modules
var BasicBroker     = require('./stomp-server/basicbroker').BasicBroker,
    middleware      = require('./stomp-server/middleware'),
    net             = require('net');

// Build the broker object
var broker = new BasicBroker(65536);
broker._cf.recv_middleware.unshift({cbk: middleware.Debug});
broker._cf.send_middleware.unshift({cbk: middleware.Debug});

// Listen
var stompServer = net.createServer(broker.newConnection);
stompServer.listen(61613);

var repl = require('repl').start( 'stomp-server> ' );
repl.context.broker = broker;
repl.context.stompServer = stompServer;

