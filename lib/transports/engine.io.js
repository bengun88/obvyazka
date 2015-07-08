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
var ClientTransportPrototype = require('../transport').ClientTransport;
var transport = require('../transport');
var TransportPrototype = transport.Transport;
var util = require('util');
var http = require('http');
var engineio = require('engine.io');
var Buffer = require('buffer').Buffer;
var events = require('events');
var Connection = require('../connection.js').Connection;

/**
 * Export
 */
module.exports.Server = Server;
module.exports.Client = ClientTransport;
module.exports.Transport = Transport;

var debugEnabled = false;
var debug = function (x) {};
if (debugEnabled) {
    var pid = process.pid;
    debug = function (x) {
        // if console is not set up yet, then skip this.
        if (!console.error)
            return;
        console.error('obvyazka engine.io: %d', pid,
            util.format.apply(util, arguments).slice(0, 500));
    };
}

/**
 * Server
 */
//TODO maybe should validate Origin header
function Server(config) {
    // copy params:

    var self = this;
    self.config = JSON.parse(JSON.stringify(config));

    self.type = 'engine.io';
    self.ip = self.config.ip;
    if (! self.ip) throw new Error("Bad config.ip: " + self.ip);
    self.port = self.config.port;
    if (! self.port) throw new Error("Bad config.port: " + self.port);
	self.heloFromClient = self.config.heloFromClient;
	if (! self.heloFromClient) throw new Error("Bad config.heloFromClient:"  + self.heloFromClient);
	self.heloFromServer = self.config.heloFromServer;
	if (! self.heloFromServer) throw new Error("Bad config.heloFromServer:"  + self.heloFromServer);

    // create server:
    self.httpServer = http.createServer(function (req, res) {
        res.writeHead(501);
        res.end('Not Implemented');
    });
    self.engine = engineio.attach(this.httpServer);
    self.listening = false;

    self.httpServer.on('listening', function () {
        self.listening = true;
        debug('Listening on ' + self.ip + ':' + self.port);

        self.emit('listening');
    });

    self.httpServer.on('close', function () {
        debug('Server closed (' + self.ip + ':' + self.port + ')');
    });

    self.httpServer.on('error', function (e) {
        debug('Error occured: ' + e + ' on\n ' + e.stack);
        self.emit('error', e);
    });

    self.engine.on('connection', self._onConnection.bind(self));
}
util.inherits(Server,ServerPrototype);

Server.prototype.listen = function () {
	this.httpServer.listen(this.port, this.ip);
};

Server.prototype._onConnection = function(conn){
    var self = this;

    //TODO proper debug line
    debug('New connection (' + conn.remoteAddress + ':' + conn.remotePort + '-' + conn.localAddress + ':' + conn.localPort + ')');
    var oc = new Connection();

    function onHelo(heloStr){
        var helo = JSON.parse(heloStr);
        if (helo.helo != self.heloFromClient){
            conn.send("WRONG CID MARKER");
            conn.close();
            return;
        }
        if (helo.cid != ""){
            oc.cid = helo.cid;
        }
        var transport = new Transport(conn);
        oc.changeTransport(transport);
        self.emit('connection', oc);

        conn.send(JSON.stringify({
            cid:oc.cid,
            helo:self.heloFromServer
        }));
        conn.removeListener('message', onHelo);
        conn.on('message', onMessage);
    }

    function onMessage(data){

    }

    conn.on('message', onHelo);
};

Server.prototype.close = function () {
    this.httpServer.close();
};

/**
 * Transport
 */
function Transport(c) {
    var transport = this;
    transport.closed = false;
    transport.connection = c;

    transport.remoteAddress = c.remoteAddress;

    c.on('message', function (data) {
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
    this.connection.close();
    this.closed = true;
    this.emit('close');
};


function ClientTransport(config){
   throw new Error("unimplemented client transport for engine.io");
}
util.inherits(ClientTransport,ClientTransportPrototype);