
// stomp-server/basicbroker.js -- Definition of the BasicBroker class

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
var middleware          = require('./middleware'),
    Broker              = require('./broker').Broker,
    Frame               = require('./frame').Frame,
    sys                 = require('sys');

// keep a table of subscriptions by regular expression
// keep a table mapping destinations to subscriptions
function BasicBroker(bufferLimit) {
    var self = this;

    // Extend Broker
    Broker.call(this, bufferLimit);

    // Initialize the subscription table
    this.subscriptions = [];

    // Initialize the destination table
    this.destinations = {};

    // Extend default middleware
    this._cf.recv_middleware.push({cbk: SubscribeRecvCurry(this)});
    this._cf.recv_middleware.push({cbk: middleware.TimestampFrame});
    this._cf.recv_middleware.push({cbk: SendRecvCurry(this)});

    // Install the automatic RECEIPT command middleware
    this._cf.recv_middleware.push({cbk: middleware.AutoReceiptRecv});

    // Clean up subscriptions on connection close
    var orig_newConnection = this.newConnection;
    this.newConnection = function(stream) {
        // Construct a connection
        var conn = orig_newConnection(stream);

        // Remove all connection subscriptions on close event
        conn.on('close', function(had_error) { self.unsubscribe(conn); });

        // Operation Complete!
        return conn;
    };
}
sys.inherits(BasicBroker, Broker);

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
        else if( destination == null && id == null )
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
        for( var i in dst.subscriptions ) {
            var subscr = dst.subscriptions[i];
            var headers = filterHeaders(frame_obj.headers);

            // FIXME: Errors should still be thrown, but attempts should be
            // made on each subscription, regardless of errors on various attempts.

            // Transmit a MESSAGE frame
            var frame_out = new Frame('MESSAGE', headers, frame_obj.body);
            if( subscr.id )
                frame_out.headers.id = subscr.id;
            broker._cf.send_frame(subscr.conn, frame_out);
        }

        // Operation Complete!
        frame_obj.handled = true;
        return frame_obj;
    };
}

var _re_x_header = /^x-/;
var _pass_headers = ['reply-to', 'destination', 'timestamp'];
function filterHeaders(headers) {
    var hdr_out = {};
    for( var i in headers )
        if( _pass_headers.indexOf(i) >= 0
            || _re_x_header.test(i) )
            hdr_out[i] = headers[i];

    // Operation Complete!
    return hdr_out;
}

// Export classes
module.exports.BasicBroker = BasicBroker;
