/*!
 *  OBVYAZKA
 *  Copyright (c) 2013 cheshkov mikhail
 *  Copyright (c) 2013 myachin sergey
 *  MIT Licensed  
 */
 
/**
 * Module dependencies
 */ 
var crypto     = require('crypto');
var events     = require('events');
var util       = require('util');
var Connection = require('./connection').Connection;
var CID        = require('./cid');

/**
 * Export
 */
module.exports.Server = Server;
module.exports.createServer = createServer;

/**
 * Creates new object of Server class.
 *
 * @constructor
 * @this {Server}
 */
function Server() {
  var server = this;
  server.transportServers = [];

  // Full list of connections. Contains pairs: cid -> connection.
  server.connections = {};
  
  // Default config for Transport Servers.
  server.defaultConfig = { helo: "O2HELO", domains: [] };

  // Interval for checking hanged up connections in ms:
  server.defaultCheckingInterval = 5000;

  // Full list of ip:port. For crossdomain policy lists. Contains:
  //  { "1.2.3.4": [80,81,82], "1.2.3.5": [8080,8090] }
    server._openedPorts = {};

  /**
   *  Register new connection:
   *  @param {Connection} c Connection to be registered
   */
  server.registerConnection = function(c) {
    // CID (connection id) generation
    do {
      var cid = CID.generateCID();
    } while ( server.connections[cid] !== undefined );

    server.connections[cid] = c;
    c.cid    = cid;
    c.server = server;
  }

  server.closed = false;
}
util.inherits(Server, events.EventEmitter);

Server.prototype.listen = function( array ) {
    // Starting checking of hanged connections:
    if ( this.defaultCheckingInterval > 0 ) {
        this._startChecking();
    }

    this._waitForListening = array.length;

    for(var i in array) {
        var conf = array[i];
        this.listenTransport(conf.type, conf.ip, conf.port, conf.config);
    }
};

/**
 *  Add and start to listen one transport server.
 *
 *  @param {string} type  Transport type. 'TCP', 'HTTP' and other.
 *      Each transport defined in corresponding file in transports folder.
 *      For example, 'TCP' defined in transports/TCP.js
 *  @param {string} ip    Listening ip address.
 *  @param {number} port  Listening port.
 *  @param {object} config  Additional settings. Optional.
 */
Server.prototype.listenTransport = function( type, ip, port, config ) {
    // Copy default parameters from defaultConfig:
    config = config || {};
    for ( var param in this.defaultConfig ) {
        if ( config[param] === undefined ) {
            config[param] = JSON.parse(JSON.stringify(this.defaultConfig[param]));
        }
    }

    // Update this._openedPorts list:
    if ( this._openedPorts[ip] === undefined ) {
        this._openedPorts[ip] = [];
    }
    this._openedPorts[ip].push( port );

    // Creating new transport server:
    var transportModule = require( "./transports/" + type + ".js" );
    var transportServer = new transportModule.Server( this, ip, port, config, this._openedPorts );
    this.transportServers.push( transportServer );

    function listenError(err){
        throw err;
    }

    var self = this;

    transportServer.on('error',listenError);
    transportServer.on('listening',function(){
        transportServer.removeListener('error',listenError);

        self._waitForListening--;
        if (self._waitForListening === 0) self.emit('listening');

    });
    var self = this;
    transportServer.on('connection', self._onConnection.bind(self));

    transportServer.listen();
};

Server.prototype._onConnection = function(c){
    var self = this;

    if (c.cid === null){
        do {
            c.cid = CID.generateCID();
        } while ( self.connections[c.cid] !== undefined );

        self.connections[c.cid] = c;
        c.on('end',self._onConnectionEnd.bind(self,c));

        self.emit('connection',c);
    } else if (self.connections[c.cid] === undefined){
        throw new Error("New connection with bad CID");
    } else {
        self.connections[c.cid].changeTransport(c.transport);
    }
};

Server.prototype._onConnectionEnd = function(c){
    var self = this;

    delete self.connections[c.cid];
};

Server.prototype._startChecking = function () {
    var self = this;

    self._timeoutCheckingInterval = setInterval(function () {
        for (var i in self.connections) {
            if (self.connections[i].timeout !== undefined &&
                self.connections[i].transport === null &&
                self.connections[i].timeout < new Date().getTime()) {
                console.log('o2s need to end o2c');
                self.connections[i].end();
            }
        }
    }, this.defaultCheckingInterval);
};

Server.prototype._stopChecking = function () {
    var self = this;

    clearInterval(self._timeoutCheckingInterval);
};

/**
 *  Add domain to list of allowed domains (crossdomain policy). Default "*".
 *
 *  @param {string} domain Any domain: 'example.com'.
 */
Server.prototype.allowAccessFrom = function( domain ) {
    if ( typeof(domain) == "string" ) {
        this.defaultConfig.domains.push( domain );
    } else {
        throw new Error( "Invalid domain format" );
    }
};

/**
 *  Check and return connection with cid
 *  @return {Connection} New registered connection:
 */
Server.prototype.getConnectionByCid = function( cid ) {
    return this.connections[cid];
};

/**
 *  Close server. Closes all transport and free all resources.
 */
Server.prototype.close = function() {
    this.closed = true;
    for (var i in this.transportServers) {
        this.transportServers[i].close();
    }

    if ( this.defaultCheckingInterval > 0 ) {
        this._stopChecking();
    }
};

/**
 *  Create registered to server connection:
 *  @return {Connection} New registered connection:
 */
Server.prototype.createConnection = function() {
    if (this.closed) return null;
    var connection = new Connection(this);
    this.registerConnection(connection);
    return connection;
};

/**
 *  createServer() in node 'net'-module style
 */
function createServer(callback) {
  var server = new Server();
  server.on('connection', callback);
  return server;
}