/*!
 * 	OBVYAZKA
 *	Copyright (c) 2013 cheshkov mikhail
 *	Copyright (c) 2013 myachin sergey
 *	MIT Licensed	
 */

/**
 * Module dependencies
 */
var server = require('./server');
var client = require('./client');

/**
 * Export
 */
module.exports.createClient = client.createClient;
module.exports.createServer = server.createServer;
module.exports.Server = server.Server;
module.exports.Client = client;