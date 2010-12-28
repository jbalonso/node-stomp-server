
// stomp-server/basicbroker.js -- Definition of the BasicBroker class

// Load modules
var middleware          = require('./middleware'),
    Broker              = require('./broker').Broker,
    Frame               = require('./frame').Frame;

// keep a table of subscriptions by regular expression
// keep a table mapping destinations to subscriptions
function BasicBroker(bufferLimit) {
    // Extend Broker
    Broker.call(this, bufferLimit);

    // Initialize the subscription table
    this.subscriptions = [];

    // Initialize the destination table
    this.destinations = {};

    // Extend default middleware
    this._cf.recv_middleware.push({cbk: SubscribeRecvCurry(this)});
    this._cf.recv_middleware.push({cbk: SendRecvCurry(this)});

    // Install the automatic RECEIPT command middleware
    this._cf.recv_middleware.push({cbk: middleware.AutoReceiptRecv});
}

// NOTE: This routine aims to escape all regular expression characters *except*
// for *
var escapeChars = /([\[\]\(\)\{\}\/\\\?\+\^\$\|\.\!])/;
function escapePattern(str) {
    return str.replace(escapeChars, '\\$1');
}

function patternFromDestination(destination) {
    // Escape most characters
    destination = escapePattern(destination);

    // Escape stars
    destination = destination.replace('.*', '.[^.]+');
    destination = destination.replace('*', '\\*');

    // Escape subtree references
    destination = destination.replace('>', '(\\.[^.]+)+');

    // Force complete string match
    destination = '^' + destination + '$';

    // Operation Complete!
    return new RegExp(destination);
}

BasicBroker.prototype.subscribe = function(conn, destination, id, ack) {
    // Set defaults
    if( ack == null ) ack = 'auto';

    // Prepare the subscription structure
    var subscription = {
        rex: patternFromDestination(destination),
        destination: destination,
        id: id,
        conn: conn,
        ack: ack,
    };

    // Make sure this is not a duplicate subscription
    for( var i in this.subscriptions )
        if( this.subscriptions[i].id == id &&
            this.subscriptions[i].conn == conn )
            throw new middleware.ProtocolError(conn, null, 'Duplicate SUBSCRIBE');

    // Add the entry to the subscription table
    this.subscriptions.push(subscription);

    // Update the destination table
    for( var i in this.destinations )
        if( subscription.rex.test(i) )
            this.destinations[i].subscriptions.push(subscription);
    // FIXME: transmit messages queued for destination

    // Operation Complete!
};

BasicBroker.prototype.getDestination = function(destination) {
    // Return an existing destination if possible
    if( destination in this.destinations )
        return this.destinations[destination];

    // Prepare a new destination structure
    var dst = {subscriptions: []};

    // Find matching subscriptions
    for( var i in this.subscriptions )
        if( this.subscriptions[i].rex.test(destination) )
            dst.subscriptions.push(this.subscriptions[i]);

    // Save the new destination
    this.destinations[destination] = dst;

    // Operation Complete!
    return dst;
};

BasicBroker.prototype.unsubscribe = function(conn, destination, id) {
    // Make sure this subscription can be found
    var idx = -1;
    for( var i in this.subscriptions ) {
        if( conn != this.subscriptions[i].conn ) continue;
        if( id ) {
            if( id == this.subscriptions[i].id &&
                ( ( destination == null )
                  || (destination == this.subscriptions[i].destination)))
                idx = i;
        } else if( ( this.subscriptions[i].destination == destination )
                   && ( this.subscriptions[i].id == id ) )
            idx = i;
    }

    // Fail if no match found
    if( idx == -1 )
        throw new middleware.ProtocolError(conn, null, 'No SUBSCRIBE matches given UNSUBSCRIBE');

    // Remove record from subscription table
    var sbscr = this.subscriptions.splice(i,1);

    // Remove records from destination table
    for( var i in this.destinations ) {
        var dst = this.destinations[i];
        var idxs = [];
        for( var j in dst.subscriptions ) {
            if( conn != dst.subscriptions[j].conn ) continue;
            if( dst.subscriptions[j].destination == sbscr.destination &&
                dst.subscriptions[j].id == sbscr.id )
                idxs.unshift(j);
        }

        // NOTE: Subscriptions are removed in reverse order to keep the indices
        // valid
        for( var j in idxs )
            dst.subscriptions.splice(idxs[idxs.length-1-j],1);
    }

    // Operation Complete!
};

function SubscribeRecvCurry(broker) {
    return function(conn, frame_obj) {
        // Handle SUBSCRIBE and UNSUBSCRIBE
        switch(frame_obj.cmd) {
            case 'SUBSCRIBE':
                // Extract requisite parameters
                if( !frame_obj.headers.destination )
                    throw new middleware.ProtocolError(conn, frame_obj, 'SUBSCRIBE requires a destination header');
                var destination = frame_obj.headers.destination;
                var id = frame_obj.headers.id;
                var ack = frame_obj.headers.ack || 'auto';

                // Subscribe
                broker.subscribe(conn, destination, id, ack);

                // Request is handled
                frame_obj.handled = true;
                break;

            case 'UNSUBSCRIBE':
                // Extract requisite parameters
                if( !frame_obj.headers.destination && !frame_obj.headers.id )
                    throw new middleware.ProtocolError(conn, frame_obj, 'UNSUBSCRIBE requires at least a destination or an id header');
                var destination = frame_obj.headers.destination;
                var id = frame_obj.headers.id;

                // Unsubscribe
                broker.unsubscribe(conn, destination, id);

                // Request is handled
                frame_obj.handled = true;
                break;
            default:
        };

        // Operation Complete!
        return frame_obj;
    };
}

function SendRecvCurry(broker) {
    return function(conn, frame_obj) {
        // Handle SEND
        if( frame_obj.cmd != 'SEND' ) return frame_obj;

        // Get the destination header
        if( !frame_obj.headers.destination )
            throw new middleware.ProtocolError(conn, frame_obj, 'SEND requires a destination header');
        var destination = frame_obj.headers.destination;

        // Obtain a destination object
        // FIXME: There should be additional intelligence in constructing new
        // destination objects
        var dst = broker.getDestination(destination);

        // FIXME: The following logic should be a method of the destination
        // object

        // Push the message out to subscribers
        var headers = filterHeaders(frame_obj.headers);
        for( var i in dst.subscriptions ) {
            var subscr = dst.subscriptions[i];
            var headers = filterHeaders(frame_obj.headers);

            // Transmit a MESSAGE frame
            var frame_out = new Frame('MESSAGE', headers, frame_obj.body);
            broker._cf.send_frame(subscr.conn, frame_out);
        }

        // Operation Complete!
        frame_obj.handled = true;
        return frame_obj;
    };
}

// Export classes
module.exports.BasicBroker = BasicBroker;
