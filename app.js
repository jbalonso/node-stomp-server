
/*  Copyright 2010, Jason B. Alonso
 *
 *  This file is part of node-stomp-server.
 *  
 *  node-stomp-server is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  node-stomp-server is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *  
 *  You should have received a copy of the GNU Affero General Public License
 *  along with node-stomp-server.  If not, see <http://www.gnu.org/licenses/>
 */

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

