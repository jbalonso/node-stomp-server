
// stomp-server/frame.js -- Definition of the Frame class

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

function MalformedFrameError(description) {
    Error.call(this, 'Malformed frame: ' + description );
    this.description = description;
}

function Frame( cmd, headers, body ) {
    var self = this;

    // Handle defaults
    if( body == null ) body = '';

    // Initialize members
    this.cmd = cmd;
    this.headers = {};
    this.body = body;
    this.handled = false;

    // Load headers
    if( headers != null )
        for( var key in headers )
            this.headers[key] = headers[key]; 

    // Set content length, if applicable
    if( this.body != null )
        this.updateContentLength();
}

Frame.prototype.updateContentLength = function () {
    this.headers['content-length'] = this.body.length;
};

Frame.prototype.toBuffer = function() {
    var buffer = '';

    // Add the command
    buffer += this.cmd + '\n';

    // Add the headers
    for( var key in this.headers )
        buffer += key + ":" + this.headers[key] + '\n';
    buffer += '\n';

    // Add the body
    if( this.body != null )
        buffer += this.body;

    // End the frame
    buffer += "\0";

    // Operation Complete!
    return buffer;
};

function fromBuffer(buffer) {
    // Extract command
    var cmd = buffer.peekLine('\n');
    if( cmd == null ) {
        buffer.abortRead();
        return null;
    }

    // Extract headers
    var headers = {};
    var line = '';
    var rex = /^([^:]+):\ *(.*)$/; // NOTE: This consumes spaces after the colon
    do {
        // Extract a line
        line = buffer.peekLine('\n');
        if( line == null ) {
            buffer.abortRead();
            return null;
        }

        if( line != '' ) {
            // Parse the header line
            var match = rex.exec(line);
            if( match == null )
                throw new MalformedFrameError('Invalid header: ' + line);

            // Save the header data
            headers[match[1]] = match[2];
        }
    } while(line != '');

    // Parse content-length header
    if( headers['content-length'] != null )
        headers['content-length'] = parseInt(headers['content-length']);

    // Extract the body
    var body = '';
    if( headers['content-length'] != null ) {
        body = buffer.peekString(headers['content-length']);
        if( body == null ) {
            buffer.abortRead();
            return null;
        }
     
        // Panic if terminator is misplaced
        var verify = buffer.peekString(1);
        if( verify == null ) {
            buffer.abbortRead();
            return null;
        }
        if( verify != '\0' ) {
            buffer.commitRead();
            throw new MalformedFrameError('Frame terminator missing');
        }
    } else {
        // Read body until null terminator
        body = buffer.peekLine('\0');
        if( body == null ) {
            buffer.abortRead();
            return null;
        }
    }

    // Operation Complete!
    buffer.commitRead();
    return new Frame(cmd, headers, body);
}

// Export classes
module.exports.Frame = Frame;
module.exports.fromBuffer = fromBuffer;
