
// stomp-server/basicbroker.js -- Definition of the BasicBroker class

// Load modules
var middleware          = require('./middleware'),
    Broker              = require('./broker').Broker;


// keep a table of subscriptions by regular expression
// keep a table mapping destinations to subscriptions
function BasicBroker(bufferLimit) {
    // Extend Broker
    Broker.call(this);

    // Initialize the subscription table
    this.subscriptions = [];

    // Initialize the destination table
    this.destinations = {};

    // Extend default middleware
}

BasicBroker.prototype.subscribe = function(conn, pattern, id, ack) {
    // Set defaults
    if( ack == null ) ack = 'auto';

    // Prepare the subscription structure
    var subscription = {
        rex: new RegExp(pattern),
        destination: pattern,
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

BasicBroker.prototype.unsubscribe = function(conn, pattern, id) {
    // Make sure this subscription can be found
    var idx = -1;
    for( var i in this.subscriptions ) {
        if( conn != this.subscriptions[i].conn ) continue;
        if( id ) {
            if( id == this.subscriptions[i].id &&
                ( ( pattern == null )
                  || (pattern == this.subscriptions[i].destination)))
                idx = i;
        } else if( ( this.subscriptions[i].destination == pattern )
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
        
    };
}

// Export classes
module.exports.BasicBroker = BasicBroker;
