
// stomp-server/connection.js -- Definition of the Connection class

/*  Copyright 2010, Jason B. Alonso
 *
 *  This file is part of node-stomp-server.
 *  
 *  Foobar is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  Foobar is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *  
 *  You should have received a copy of the GNU Affero General Public License
 *  along with Foobar.  If not, see <http://www.gnu.org/licenses/>
 */

// Load modules
var events          = require('events'),
    frame           = require('./frame'),
    StringBuffer    = require('./stringbuffer').StringBuffer,
    sys             = require('sys');

function Connection( stream, bufferLimit ) {
    var self = this;

    // Extend EventEmitter
    events.EventEmitter.call(this);

    // Set the buffer limit
    if( bufferLimit == null )
        bufferLimit = 65536;

    // Initialize members
    this._stream = stream;
    this._buf = new StringBuffer(bufferLimit);
    this.connected = false;
    this.secure = false;
    this.bufferLimit = bufferLimit;
    this.strict = false;

    // Configure basic event handlers
    this._stream.on('connect', function() { self.emit('connect'); });
    this._stream.on('secure', function() { self.secure = true; self.emit('secure');} );
    this._stream.on('timeout', function() { self._stream.end(); self.emit('timeout'); });
    this._stream.on('end', function() { self._stream.end(); });
    this._stream.on('close', function (had_error) {
            self.connected = false;
            self.emit('close', had_error);
        });
    this._stream.on('error', function(exception) {
            self.emit('error', exception);
            if( self.strict ) self._stream.destroy();
        });

    // Define the packet serializer
    this._stream.on('data', function(data) {
            try {
                // Accumulate data in the buffer
                self._buf.write(data.toString('utf8'));

                // Extract frames
                var buffer = self._buf;
                do {
                    // Extract a single frame from the stream
                    var frame_obj = frame.fromBuffer(buffer);

                    // Emit the frame, if any
                    if( frame_obj != null )
                        self.emit('frame', frame_obj);
                } while( frame_obj != null );
            } catch( err ) {
                // Emit an error
                self.emit('error', err);

                // Close the connection if strict
                if( self.strict ) self._stream.destroy();
            };
        });
}
sys.inherits(Connection, events.EventEmitter);

// Connection.send(frame_obj, cbk(err)
Connection.prototype.send = function(frame_obj) {
    this._stream.write(frame_obj.toBuffer());
};

// Export classes
module.exports.Connection = Connection;
