
// stomp-server/server.js -- Definition of the Server class

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
var ConnectionFactory   = require('./connectionfactory').ConnectionFactory,
    frame               = require('./frame'),
    middleware          = require('./middleware');

function Server(bufferLimit) {
    var self = this;

    // Initialize members
    this._cf = new ConnectionFactory(bufferLimit);
    this.newConnection = this._cf.newConnection;

    // Load default middleware
    this._cf.recv_middleware = [
        {cbk:   middleware.ValidRecvFrame,
         ebk:   middleware.DefaultError,
        },
        {cbk:   middleware.ConnectRecv},
    ];
    this._cf.send_middleware = [
        {cbk:   middleware.ValidSendFrame},
    ];
}

// Export classes
module.exports.Server = Server;
