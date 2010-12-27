
// stomp-server/broker.js -- Definition of the Broker class

// Load modules
var ConnectionFactory   = require('./connectionfactory').ConnectionFactory,
    frame               = require('./frame'),
    middleware          = require('./middleware');

function Broker(bufferLimit) {
    var self = this;

    // Initialize members
    this._cf = new ConnectionFactory(bufferLimit);
    this.newConnection = this._cf.newConnection;

    // Load default middleware
    this._cf.recv_middleware = [
        {cbk:   middleware.ValidRecvFrame,
         ebk:   middleware.DefaultError,
        },
        {cbk:   middleware.ConnectRecv},
    ];
    this._cf.send_middleware = [
        {cbk:   middleware.ValidSendFrame},
    ];
}

// Export classes
module.exports.Broker = Broker;
