
// stomp-server/stringbuffer.js -- Definition of the StringBuffer class

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

function BufferOverflowError() {
    Error.call(this, 'StringBuffer overflow' );
}

function StringBuffer( buffer_size ) {
    var self = this;

    // Save paramters
    this._buf_size = buffer_size;

    // Save circular buffer parameters
    this._rh = 0;   // Read Head
    this._ph = 0;   // Peek Head
    this._wh = 0;   // Write Head

    // Create a buffer
    this._buf = new Buffer( buffer_size );
}

StringBuffer.prototype.peekString = function(num) {
    // Fail on requests larger than the buffer
    if( num >= (this._buf_size - 1) )
        return null;

    // Load head positions
    var ph = this._ph;
    var rh = this._rh;
    var wh = this._wh;
    var sz = this._buf_size;

    // Read extents until all data is collected
    var str = '';
    while( num > 0 ) {
        // Fail if buffer is empty
        if( ph == wh ) return null;

        // Determine the relative orientation of the heads
        var normal_side = ph < wh;

        if( normal_side ) {
            // Make sure enough data is available
            if( num > (wh - ph) ) return null;

            // Extract the string
            str += this._buf.toString('utf8', ph, ph + num);
            ph = (ph + num) % sz;
            num = 0;
        } else {
            // Determine if a partial read is required
            if( num <= (sz - ph) ) {
                str += this._buf.toString('utf8', ph, ph + num);
                ph = (ph + num) % sz;
                num = 0;
            } else {
                str += this._buf.toString('utf8', ph, sz);
                num -= (sz - ph);
                ph = 0;
            }
        }
    }

    // Update the peek head
    this._ph = ph;

    // Operation Complete!
    return str;
};

StringBuffer.prototype.peekLine = function(delim) {
    // Load head positions
    var ph = this._ph;
    var rh = this._rh;
    var wh = this._wh;
    var sz = this._buf_size;

    for( var i = 0; i < sz; i++ ) {
        var sh = (ph + i) % sz;  // Seek Head
        
        // Abort if at end of buffer
        if( sh == wh ) return null;

        // Detect match
        if( this._buf.toString('utf8', sh, sh + 1) == delim ) {
            var str = this.peekString(i + 1);
            str = str.slice(0, i);
            return str;
        }
    }
};

StringBuffer.prototype.commitRead = function() {
    this._rh = this._ph;
};

StringBuffer.prototype.abortRead = function() {
    this._ph = this._rh;
};

StringBuffer.prototype.getReadLength = function() {
    // Load head positions
    var rh = this._rh;
    var wh = this._wh;
    var sz = this._buf_size;

    // Operation Complete!
    return (wh - rh + sz) % sz;
}

StringBuffer.prototype.getPeekLength = function() {
    // Load head positions
    var ph = this._ph;
    var wh = this._wh;
    var sz = this._buf_size;

    // Operation Complete!
    return (wh - ph + sz) % sz;
}

StringBuffer.prototype.write = function(str) {
    // Load head positions
    var ph = this._ph;
    var rh = this._rh;
    var wh = this._wh;
    var sz = this._buf_size;

    // Determine if there is space to receive the data
    // FIXME: byte counts vs. string length and UTF-8
    var space = (rh - wh - 1 + sz) % sz;
    if( space < str.length )
        throw new BufferOverflowError();

    // Determine if a wrap is required
    var len = str.length;
    var extent = sz - wh 
    if( len > (sz - wh) ) {
        this._buf.write(str.slice(0, extent), wh, 'utf8');
        this._buf.write(str.slice(extent, len), 0, 'utf8');
        wh = len - extent;
    } else {
        this._buf.write(str, wh, 'utf8');
        wh += len;
    }

    // Update the write head
    this._wh = wh % sz;

    // Operation Complete!
    return len;
};

module.exports.StringBuffer = StringBuffer;
module.exports.BufferOverflowError = BufferOverflowError;
