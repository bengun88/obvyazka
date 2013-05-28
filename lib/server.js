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
  var defaultCheckingInterval = 5000;

  // Full list of ip:port. For crossdomain policy lists. Contains:
  //  { "1.2.3.4": [80,81,82], "1.2.3.5": [8080,8090] }
  var openedPorts = {}; 

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
  server.listenTransport = function( type, ip, port, config ) { 
    // Copy default parameters from defaultConfig:
    config = config || {};
    for ( var param in server.defaultConfig ) {
      if ( config[param] === undefined ) {
      config[param] = JSON.parse(JSON.stringify(server.defaultConfig[param]));
      }
    }
    
    // Update openedPorts list:
    if ( openedPorts[ip] === undefined ) {
      openedPorts[ip] = [];
    }
    openedPorts[ip].push( port );
    
    // Creating new transport server:   
    var transportModule = require( "./transports/" + type + ".js" );
    var transportServer = new transportModule.Server( server, ip, port, config, openedPorts );
    server.transportServers.push( transportServer );
    transportServer.on('connection', function(oc){
      server.emit( 'connection', oc );
    });
  }

  server.listen = function( array ) {
    for(var i in array) {
      var conf = array[i];
      server.listenTransport(conf.type, conf.ip, conf.port, conf.config);
    }
  }
  
  /**
   *  Add domain to list of allowed domains (crossdomain policy). Default "*".
   *    
   *  @param {string} domain Any domain: 'example.com'.
   */ 
  server.allowAccessFrom = function( domain ) {
    if ( typeof(domain) == "string" ) {
      server.defaultConfig.domains.push( domain );
    } else {
      throw new Error( "Invalid domain format" );
    }
  };

  // Starting checking of hanged connections:
  if ( defaultCheckingInterval > 0 ) {
    server.timeoutCheckingInterval = setInterval( function() {
      for( var i in server.connections ) {
        if ( server.connections[i].timeout !== undefined )
        if ( server.connections[i].transport === null )
        if ( server.connections[i].timeout < new Date().getTime() ) {
          console.log('o2s need to end o2c');
          server.connections[i].end();
        }
      }
    },  defaultCheckingInterval );
  }
  
  /**
   *  Register new connection:
   *  @param {Connection} c Connection to be registered
   */  	
  server.registerConnection = function(c) {
    // CID (connection id) generation
    do {
      var hash = crypto.createHash('sha256');
      hash.update( Math.random().toString() );
      var cid = hash.digest('base64');
    } while ( server.connections[cid] !== undefined );
    
    server.connections[cid] = c;  
    c.cid    = cid;
    c.server = server;
  }
  
  /**
   *  Create registered to server connection:
   *  @return {Connection} New registered connection:
   */ 
  server.createConnection = function() {
    if (server.closed) return null;
    var connection = new Connection(server);
    server.registerConnection(connection);
    return connection;    
  }

  /**
   *  Check and return connection with cid
   *  @return {Connection} New registered connection:
   */ 
  server.getConnectionByCid = function( cid ) {
    return server.connections[cid];
  }
  
  server.closed = false;
  
  /**
   *  Close server. Closes all transport and free all resources.
   */ 
  server.close = function() {
    server.closed = true;
    for (var i in server.transportServers) {
      server.transportServers[i].close();
    }
    
    if ( defaultCheckingInterval > 0 ) {
      clearInterval( server.timeoutCheckingInterval );
    }
  }
}
util.inherits(Server, events.EventEmitter);

/**
 *  createServer() in node 'net'-module style
 */
function createServer(callback) {
  var server = new Server();
  server.on('connection', callback);
  return server;
}