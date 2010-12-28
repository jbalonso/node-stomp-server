
// stomp-server/connectionfactory.js -- Definition of the ConnectionFactory
// class

// Load modules
var events      = require('events'),
    Connection  = require('./connection').Connection,
    hashlib     = require('hashlib'),
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
    this._seed = hashlib.sha1((new Date()) + process.pid + Math.random());
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
    conn._id = hashlib.sha1(this._seed + this.conn_counter);
    this.conn_counter++;

    // Configure event handlers
    conn.on('connect', function() { self.emit('connect', conn); });
    conn.on('secure', function() { self.emit('secure', conn); });
    conn.on('timeout', function() { self.emit('timeout', conn); });
    conn.on('close', function(had_error) { self.emit('close', conn, had_error); });
    conn.on('error', function(err) { self.emit('error', conn, err); });
    conn.on('frame', function(frame_obj) {
            // Process frame for reception through middleware
            var layer, error_obj;
            for( layer = 0; layer < this.recv_middleware.length; layer++ ) {
                try {
                    if( frame_obj && this.recv_middleware[layer].cbk )
                        frame_obj = this.recv_middleware[layer].cbk.call(this, conn, frame_obj);
                    else if( error_obj && this.recv_middleware[layer].ebk )
                        frame_obj = this.recv_middleware[layer].ebk.call(this, conn, error_obj);
                    error_obj = null;
                } catch( err ) {
                    error_obj = err;
                    frame_obj = null;
                }
            }

            // Handle remains
            if( frame_obj ) this.emit('frame', conn, frame_obj);
            else if( error_obj ) this.emit('error', error_obj);
        });
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
