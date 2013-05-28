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
module.exports.Transport = Transport;
 
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
  var transport = this;
  
  transport.send = function( bufferToSend ) {
    throw new Error("Try to call function in abstract class. Transport.send()");
  }
  
  transport.close = function() {
    throw new Error("Try to call function in abstract class. Transport.close()");
  }    
}
util.inherits(Transport, events.EventEmitter);