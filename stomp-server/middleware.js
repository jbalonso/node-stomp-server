
// stomp-server/middleware.js -- Basic broker middleware

// Load modules
var frame = require('./frame');

function InvalidFrameError(conn, frame_obj, description) {
    Error.call(this, 'Invalid frame: ' + description );
    this.conn = conn;
    this.frame_obj = frame_obj;
    this.description = description;
}

function ProtocolError(conn, frame_obj, description) {
    Error.call(this, 'Protocol error: ' + description );
    this.conn = conn;
    this.frame_obj = frame_obj;
    this.description = description;
}

function Debug(conn, frame_obj) {
    console.log(frame_obj.cmd
                + ' '
                + JSON.stringify(frame_obj.headers)
                + ' '
                + JSON.stringify(frame_obj.body)
                + '\r');
    return frame_obj;
}

function DefaultError(conn, error_obj) {
    // Log error
    console.log('error: ' + error_obj.toString() + '\r\n');

    // Construct an ERROR frame
    var frame_obj = new frame.Frame('ERROR', null, error_obj.toString());
    
    // Send the ERROR frame
    this.send_frame(conn, frame_obj);

    // Operation Complete!
    return null;
}

function ValidRecvFrame(conn, frame_obj) {
    switch(frame_obj.cmd) {
        case 'CONNECT':
        case 'SUBSCRIBE':
        case 'UNSUBSCRIBE':
        case 'BEGIN':
        case 'COMMIT':
        case 'ABORT':
        case 'ACK':
        case 'DISCONNECT':
        case 'SEND':
            return frame_obj;
            break;
        default:
            throw new InvalidFrameError(conn, frame_obj, 'Invalid client command');
    }
}

function ValidSendFrame(conn, frame_obj) {
    switch(frame_obj.cmd) {
        case 'CONNECTED':
        case 'MESSAGE':
        case 'RECEIPT':
        case 'ERROR':
            return frame_obj;
            break;
        default:
            throw new InvalidFrameError(conn, frame_obj, 'Invalid server command');
    }
}

function ConnectRecv(conn, frame_obj) {
    // Make sure the client is connected
    if( !conn.connected ) {
        if( frame_obj.cmd != 'CONNECT' )
            throw new ProtocolError(conn, frame_obj, 'Client must CONNECT');
        // Automatically accept the client
        this.send_frame(
                conn,
                new frame.Frame('CONNECTED', {session: conn._id}));
        conn.connected = true;
        frame_obj.handled = true;
    }

    // Operation Complete!
    return frame_obj;
}

// NOTE: This middleware layer should be applied after frame is processed
function AutoReceiptRecv(conn, frame_obj) {
    if( frame_obj.headers.receipt )
        this.send_frame(
                conn,
                new frame.Frame(
                    'RECEIPT',
                    {'receipt-id': frame_obj.headers.receipt}));

    // Operation Complete!
    return frame_obj;
}

// Export middleware
module.exports.InvalidFrameError = InvalidFrameError;
module.exports.ProtocolError = ProtocolError;
module.exports.DefaultError = DefaultError;
module.exports.ValidRecvFrame = ValidRecvFrame;
module.exports.ValidSendFrame = ValidSendFrame;
module.exports.ConnectRecv = ConnectRecv;
module.exports.Debug = Debug;
