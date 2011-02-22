var crypto = require('crypto');

function hash(digest) {
    var h = crypto.createHash(digest);
    return function(msg, fmt) {
        h.update(msg);
        var result = h.digest(fmt);
        h = crypto.createHash(digest);
        return result;
    };
}

module.exports = hash;
