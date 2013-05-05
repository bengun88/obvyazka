/*!
 * 	OBVYAZKA
 *	Copyright (c) 2013 cheshkov mikhail
 *	Copyright (c) 2013 myachin sergey
 *	MIT Licensed	
 */

/**
 * Module dependencies
 */
var events = require('events'); 
var server = require('./server');

/**
 * Export
 */
module.exports.createServer = server.createServer;
module.exports.Server = server.Server;

