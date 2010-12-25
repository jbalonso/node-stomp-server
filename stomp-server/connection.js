
// stomp-server/connection.js -- Definition of the Connection class

// Load modules
var events          = require('events'),
    frame           = require('./frame'),
    StringBuffer    = require('./stringbuffer').StringBuffer;

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
    this._stream.on('connect', function() { self.connected = true; self.emit('connect'); });
    this._stream.on('secure', function() { self.secure = true; } );
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
                self._buf.write(data);

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

// Connection.send(frame_obj, cbk(err)
Connection.prototype.send = function(frame_obj) {
    this._stream.write(frame_obj.toBuffer());
};

// Export classes
module.exports.Connection = Connection;
