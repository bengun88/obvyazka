/*!
 * 	OBVYAZKA
 *  Abstract class for Transport.
 *	Copyright (c) 2013 cheshkov mikhail
 *	Copyright (c) 2013 myachin sergey
 *	MIT Licensed	
 */

/**
 * Module dependencies
 */
var events = require('events');
var util       = require('util');

/**
 * Export
 */
module.exports.Server = Server;
module.exports.Transport = Transport;
module.exports.ClientTransport = ClientTransport;

/**
 * Creates new object of TransportServer class.
 *
 * If you want to write your own TransportServer, please:
 * - emit('listening') when listening started, i.e bind success
 * - emit ('connection',c)
 * listen()
 * close()
 * @constructor
 * @this {Transport}
 */
function Server() {
}
util.inherits(Server, events.EventEmitter);

Server.prototype.listen = function() {
    throw new Error("Try to call function in abstract class. Transport.send()");
};

Server.prototype.close = function() {
    throw new Error("Try to call function in abstract class. Transport.close()");
};
 
 /**
 * Creates new object of Transport class.
 *
 * If you want to write your own Transport, please:
 * - define transport.send() as function that sends buffer data to client;
 * - define transport.close() as function that force closing transport and free resources;
 * - emit('data',buffer) when you get new portion of data from client.
 * - emit('close') when connection closed.
 *
 * @constructor
 * @this {Transport}
 */
function Transport() {
}
util.inherits(Transport, events.EventEmitter);

Transport.prototype.send = function( bufferToSend ) {
    throw new Error("Try to call function in abstract class. Transport.send()");
};

Transport.prototype.close = function() {
    throw new Error("Try to call function in abstract class. Transport.close()");
};

/**
 * Client side class that actually do network stuff
 *
 * If you want to write your own Transport, please:
 * - define transport.connect() as function that connect to server, with optional argument cid - connection id.
 * If cid passed - Transport should try to resume commection, else to begin new connection
 * - define transport.send() as function that sends buffer data to client;
 * - define transport.close() as function that force closing transport and free resources;
 * - emit('connect',cid) when transport have connected
 * - emit('data',buffer) when you get new portion of data from client.
 * - emit('close') when connection closed.
 *
 *
 * @constructor
 */
function ClientTransport(){
}

util.inherits(ClientTransport, Transport);

ClientTransport.prototype.connect = function(cid) {
    throw new Error("Try to call function in abstract class. ClientTransport.connect()");
};

ClientTransport.prototype.send = function( bufferToSend ) {
    throw new Error("Try to call function in abstract class. ClientTransport.send()");
};

ClientTransport.prototype.close = function() {
    throw new Error("Try to call function in abstract class. ClientTransport.close()");
};