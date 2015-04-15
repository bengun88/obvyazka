var Connection = require("./connection.js").Connection;
var events = require('events');
var util = require('util');
var EventEmitter = events.EventEmitter;

function Client(){
    this._transports = [];
    this._currentTransportIdx = 0;
    this.retriesPerTransport = this._currentTransportRetriesLeft = 3;    
    this.connection = new Connection();

    this.cid = null;
}
util.inherits(Client,EventEmitter);

Client.prototype.connect = function(transports){
    this._transports[this._currentTransportIdx] = JSON.parse(JSON.stringify(transports));    
    this._reconnect();
};

Client.prototype._reconnect = function(){
    var self = this;

    if (this._currentTransportRetriesLeft == 0){
        this._currentTransportIdx++;
        this._currentTransportRetriesLeft = this.retriesPerTransport;
    }
    if (this._currentTransportIdx > this._transports.length){
        //TODO conneciton closed or error while connect
    }

    if (this._currentTransport){
        this._currentTransport.removeAllListeners();
    }
    this._currentTransport = createTransport(this._transports[this._currentTransportIdx]);    
    this._currentTransport.on('connect',function(cid){        
        //TODO handler for reconnect
            self.cid = cid;
            self.connection.changeTransport(self._currentTransport);
            self.emit('connect',self.connection);        
    });

    this._currentTransport.connect(self.cid);
};

function createTransport(config){    
    var transportModule = require( "./transports/" + config.type + ".js" );    
    var transportClient = new transportModule.Client(config);
    return transportClient;
}

module.exports = Client;
module.exports.createClient = createClient;

function createClient(callback) {
  var client = new Client();
  client.on('connect', callback);
  return client;
}