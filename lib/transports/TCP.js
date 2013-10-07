/*!
 *  OBVYAZKA
 *  TCP Transport
 *  Copyright (c) 2013 cheshkov mikhail
 *  Copyright (c) 2013 myachin sergey
 *  MIT Licensed  
 */

/**
 * Module dependencies
 */
var ServerPrototype = require('../transport').Server;
var transport = require('../transport');
var TransportPrototype = transport.Transport;
var util = require('util');
var net = require('net');
var Buffer = require('buffer').Buffer;
var events = require('events');
var CID = require('../cid.js');
var Connection = require('../connection.js').Connection;
var makeCrossdomainXML = require('../crossdomain.js').makeCrossdomainXML;

/**
 * Export
 */
module.exports.Server = Server;
module.exports.Transport = Transport;

var debugEnabled = false;
var debug = function (x) {
};
if (debugEnabled) {
    var pid = process.pid;
    debug = function (x) {
        // if console is not set up yet, then skip this.
        if (!console.error)
            return;
        console.error('obvyazka tcp: %d', pid,
            util.format.apply(util, arguments).slice(0, 500));
    };
}

var POLICY_FILE_REQUEST = "policy-file-request";
var policyRegExp = new RegExp(POLICY_FILE_REQUEST);

/**
 * Server
 */
function Server(config) {
    // copy params:

    var self = this;
    self.config = JSON.parse(JSON.stringify(config));

    self.type = 'TCP';
    self.ip = self.config.ip;
    if (! self.ip) throw new Error("Bad config.ip: " + self.ip);
    self.port = self.config.port;
    if (! self.port) throw new Error("Bad config.port: " + self.port);
	self.heloFromClient = self.config.heloFromClient;
	if (! self.heloFromClient) throw new Error("Bad config.heloFromClient:"  + self.heloFromClient);
	self.heloFromServer = self.config.heloFromServer;
	if (! self.heloFromServer) throw new Error("Bad config.heloFromServer:"  + self.heloFromServer);

    // create server:
    self.nodeServer = new net.Server();
    self.listening = false;

    self.nodeServer.on('listening', function () {
        self.listening = true;
        debug('Listening on ' + self.ip + ':' + self.port);

        self.emit('listening');
    });

    self.nodeServer.on('close', function () {
        debug('Server closed (' + self.ip + ':' + self.port + ')');
    });

    self.nodeServer.on('error', function (e) {
        debug('Error occured: ' + e + ' on\n ' + e.stack);

        self.emit('error', e);
    });

    self.nodeServer.on('connection', self._onConnection.bind(self));

    var items = [];
    for (var i in self.config.domains) {
        items.push({domain: self.config.domains[i], ports: [self.port]});
    }

    // Если домены не указаны, разрешаем доступ с любого домена:
    if (items.length === 0) {
        items = [
            {domain: '*', ports: [self.port]}
        ];
    }

    // Составляем XML кроссдоменной политики:
    self._crossdomainXML = makeCrossdomainXML(items);
}
util.inherits(Server,ServerPrototype);

Server.prototype.listen = function () {
	this.nodeServer.listen(this.port, this.ip);
};

Server.prototype._onConnection = function(conn){
    var self = this;

    debug('New connection (' + conn.remoteAddress + ':' + conn.remotePort + '-' + conn.localAddress + ':' + conn.localPort + ')');

    conn.setNoDelay();

    var data = new Buffer(0);
    var gotHelo = false;
    var helo_bl = Buffer.byteLength(self.heloFromClient);
	var gotCIDMarker = false;
	var CIDMarker;
	var gotCID = false;
	var cid;
	var oc = new Connection();

    function onData(dataReceived){
        data = Buffer.concat([data,dataReceived],data.length + dataReceived.length);
		if (!gotHelo && policyRegExp.test(data.toString())){
			// Посылаем XML и закрываем сокет:
			c.end(self._crossdomainXML);
			return;
		}
        if (!gotHelo && data.length < helo_bl) return;

		// Wrong helo?
		if ( data.toString('utf8',0,helo_bl) != self.heloFromClient ) {
			conn.end("WRONG HELO");
			return;
		}

		// Если HELO подошел мы должны обрезать данные, чтобы передать их дальше.
		data = data.slice(helo_bl);
		gotHelo = true;

		if (!gotCIDMarker && data.length === 0) return;

		CIDMarker = data.toString('utf8',0,1);
		gotCIDMarker = true;
		data = data.slice(1);

		if (CIDMarker === '#'){
			//new connection without CID
			var transport = new Transport(conn);
			oc.changeTransport(transport);
			self.emit('connection', oc);

			conn.write(self.heloFromServer);
			conn.write('@');
			conn.write(oc.cid);

			conn.removeListener('data',onData);

			if (data.length > 0) {
				transport.emit('data', data);
			}
		}
		else if (CIDMarker === '@'){
			//reconnection with CID
			if (!gotCID && data.length < CID.CID_BYTES * 2) return;


			cid = data.toString('utf8',0,CID.CID_BYTES * 2);
			if (! CID.isValidCID(cid)) throw new Error("Bad CID in new connection");
			oc.cid = cid;

			// Если HELO подошел мы должны обрезать данные, чтобы передать их дальше.
			data = data.slice(CID.CID_BYTES * 2);
			gotCID = true;

			//new connection without CID
			var transport = new Transport(conn);
			oc.changeTransport(transport);
			self.emit('connection', oc);

			conn.write(self.heloFromServer);
			conn.write('#');

			conn.removeListener('data',onData);

			if (data.length > 0) {
				transport.emit('data', data);
			}
		}
		else {
			//Somthing go wrong
			conn.end("WRONG CID MARKER");
		}
    }

    conn.on('data', onData);
};

Server.prototype.close = function () {
    this.nodeServer.close();
};

/**
 * Transport
 */
function Transport(c) {
    var transport = this;
    transport.closed = false;
    transport.connection = c;

    transport.remoteAddress = c.remoteAddress;

    c.on('data', function (data) {
        transport.emit('data', data);
    });

    c.on('close', function () {
        console.log('c -> rcvd close');
        if (!transport.closed) {
            transport.closed = true;
            transport.emit('close');
        }
    });
}
util.inherits(Transport, TransportPrototype);

Transport.prototype.send = function (bufferToSend) {
    try {
        this.connection.write(bufferToSend)
    } catch (err) {
        console.log('c -> error writing socket');
        if (!this.closed) {
            this.closed = true;
            this.emit('close');
        }
    }
};

Transport.prototype.close = function () {
    console.log('c -> force closing');
    this.removeAllListeners();
    this.connection.removeAllListeners();
    this.connection.end();
    this.connection.destroy();
    this.closed = true;
    this.emit('close');
};