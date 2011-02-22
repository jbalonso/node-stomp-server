
// stomp-server/connectionfactory.js -- Definition of the ConnectionFactory
// class

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
var events      = require('events'),
    Connection  = require('./connection').Connection,
    sha1        = require('./hash')('sha1'),
    sys         = require('sys');

// Middleware structure: [{cbk: function(frame), ebk: function(frame)}...]
// recv_middleware 
// send_middleware
function ConnectionFactory(bufferLimit) {
    var self = this;

    // Set the buffer limit
    if( bufferLimit == null )
        bufferLimit = 65536;

    // Initialize members
    this.bufferLimit = bufferLimit;
    this.recv_middleware = [];
    this.send_middleware = [];
    this._seed = sha1((new Date()) + process.pid + Math.random());
    this.conn_counter = 0;

    // Extend EventEmitter
    events.EventEmitter.call(this);

    // Prepare the factory closure
    this.newConnection = function(stream) {
        return self._newConnection(stream);
    };
}
sys.inherits(ConnectionFactory, events.EventEmitter);

ConnectionFactory.prototype._newConnection = function(stream) {
    var self = this;

    // Construct a new Connection object
    var conn = new Connection(stream, this.bufferLimit);

    // Set the connection id
    conn._id = sha1(this._seed + this.conn_counter, 'hex');
    this.conn_counter++;

    // Configure event handlers
    conn.on('connect', function() { self.emit('connect', conn); });
    conn.on('secure', function() { self.emit('secure', conn); });
    conn.on('timeout', function() { self.emit('timeout', conn); });
    conn.on('close', function(had_error) { self.emit('close', conn, had_error); });
    conn.on('error', function(err) { console.log(err); console.log(err.stack); self.emit('error', conn, err); });
    conn.on('frame', function(frame_obj) {
            // Process frame for reception through middleware
            var layer, error_obj;
            for( layer = 0; layer < self.recv_middleware.length; layer++ ) {
                try {
                    if( frame_obj && self.recv_middleware[layer].cbk )
                        frame_obj = self.recv_middleware[layer].cbk.call(self, conn, frame_obj);
                    else if( error_obj && self.recv_middleware[layer].ebk )
                        frame_obj = self.recv_middleware[layer].ebk.call(self, conn, error_obj);
                    error_obj = null;
                } catch( err ) {
                    error_obj = err;
                    frame_obj = null;
                }
            }

            // Handle remains
            if( frame_obj ) self.emit('frame', conn, frame_obj);
            else if( error_obj ) self.emit('error', error_obj);
        });

    // Operation Complete!
    return conn;
};

ConnectionFactory.prototype.send_frame = function(conn, frame_obj) {
    // Process frame for transmission through middleware
    var layer, error_obj;
    for( layer = 0; layer < this.send_middleware.length; layer++ ) {
        try {
            if( frame_obj && this.send_middleware[layer].cbk )
                frame_obj = this.send_middleware[layer].cbk.call(this, conn, frame_obj);
            else if( error_obj && this.send_middleware[layer].ebk )
                frame_obj = this.send_middleware[layer].ebk.call(this, conn, error_obj);
            error_obj = null;
        } catch( err ) {
            error_obj = err;
            frame_obj = null;
        }
    }

    // Transmit the frame
    if( frame_obj ) conn.send(frame_obj);

    // Operation Complete!
};

// Export classes
module.exports.ConnectionFactory = ConnectionFactory;
