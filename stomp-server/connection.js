
// stomp-server/connection.js -- Definition of the Connection class

// Load modules
var events  = require('events'),
    frame   = require('./frame');

function Connection( stream ) {
    var self = this;

    // Extend EventEmitter
    events.EventEmitter.call(this);

    // Initialize members
    this._stream = stream;
    this._buffer = "";
    this.connected = false;
    this.secure = false;
    this.bufferLimit = null;

    // Configure basic event handlers
    this._stream.on('connect', function() { self.connected = true; self.emit('connect'); });
    this._stream.on('secure', function() { self.secure = true; } );
    this._stream.on('error', function(exception) { self.emit('error', exception); });
    this._stream.on('timeout', function() { self._stream.end(); self.emit('timeout'); });
    this._stream.on('end', function() { self._stream.end(); });
    this._stream.on('close', function (had_error) {
            self.connected = false;
            self.emit('close', had_error);
        });

    // Define the packet serializer
    this._stream.on('data', function(data) {
            // Accumulate data in the buffer
            self.buffer += data;
            if( self.bufferLimit != null ) {
                if( self.buffer.length > self.bufferLimit ) {
                    // Close the connection
                    self._stream.destroy();
                    self.emit('error', 'Parse buffer overflow');
                    return;
                }
            }

            // Extract frames
            var buffer = self.buffer;
            do {
                // Extract a single frame from the stream
                var parse_pair = frame.fromBuffer(buffer);
                var frame_obj = parse_pair[0];
                buffer = parse_pair[1];

                // Emit the frame, if any
                if( frame_obj != null )
                    self.emit('frame', frame_obj);
            } while( frame_obj != null );

            // Leave remainder as buffer
            self.buffer = buffer;
        });

}

// Connection.send(frame_obj, cbk(err)
Connection.prototype.send = function(frame_obj) {
    this._stream.write(frame_obj.toString());
};

// Export classes
module.exports.Connection = Connection;
