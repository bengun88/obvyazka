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
var TransportPrototype = require('../transport').Transport;
var util = require('util');
var net = require('net');
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
var policyRexExp = new RegExp(POLICY_FILE_REQUEST);

/**
 * Server
 */
function Server(server, ip, port, config, openedPorts) {
    // copy params:

    var tcpServer = this;
    tcpServer.type = 'TCP';
    tcpServer.ip = ip;
    tcpServer.port = port;
    tcpServer.config = JSON.parse(JSON.stringify(config));

    // create server:
    tcpServer.nodeServer = new net.Server();
    tcpServer.listening = false;

    tcpServer.nodeServer.on('listening', function () {
        tcpServer.listening = true;
        debug('Listening on ' + ip + ':' + port);

        tcpServer.emit('listening');
    });

    tcpServer.nodeServer.on('close', function () {
        debug('Server closed (' + ip + ':' + port + ')');
    });

    tcpServer.nodeServer.on('error', function (e) {
        debug('Error occured: ' + e + ' on\n ' + e.stack);

        tcpServer.emit('error', e);
    });

    var items = [];
    for (var i in tcpServer.config.domains) {
        items.push({domain: tcpServer.config.domains[i], ports: openedPorts[tcpServer.ip]});
    }

    // Если домены не указаны, разрешаем доступ с любого домена:
    if (items.length === 0) {
        items = [
            {domain: '*', ports: openedPorts[tcpServer.ip]}
        ];
    }

    // Составляем XML кроссдоменной политики:
    tcpServer._crossdomainXML = makeCrossdomainXML(items);
}
util.inherits(Server,ServerPrototype);

Server.prototype.listen = function () {
    var tcpServer = this;

    tcpServer.nodeServer.on('connection', function (c) {
        debug('New connection (' + c.remoteAddress + ':' + c.remotePort + '-' + c.localAddress + ':' + c.localPort + ')');

        c.setNoDelay();

        c.once('data', firstRequestListener);
        function firstRequestListener(dataReceived) {
            var stringReceived = dataReceived.toString();
            if (policyRexExp.test(stringReceived)) {
                // Посылаем XML и закрываем сокет:
                c.end(tcpServer._crossdomainXML);
                return;
                // Иначе - проверяем HELO-фразу:
            } else if (tcpServer.config.helo != "") {
                // Wrong helo?
                if ((stringReceived.length < tcpServer.config.helo.length)
                    || ( stringReceived.substr(0, tcpServer.config.helo.length) != tcpServer.config.helo )) {
                    c.end("WRONG HELO");
                    return;
                }

                // Если HELO подошел мы должны обрезать данные, чтобы передать их дальше.
                dataReceived = dataReceived.slice(Buffer.byteLength(stringReceived.substr(0, tcpServer.config.helo.length)));
            }

            stringReceived = dataReceived.toString();

            var oc = new Connection();

            // Смотрим - а вдруг это переподключение?
            if (( stringReceived.length > 0 )
                && ( stringReceived.substr(0, 1) === '@' )) {
                // Берем cid:
                oc.cid = stringReceived.substr(1, CID.CID_BYTES * 2);
                if (! CID.isValidCID(oc.cid)) throw new Error("Bad CID in new connection");

//                // Чекаем - есть ли такой сид в списке о2-коннекций.
//                var oc = server.getConnectionByCid[cid];
//                if (oc === undefined) {
//                    oc = server.createConnection();
//                } else {
//                    process.nextTick(function () {
//                        oc.emit('transportChanged');
//                    });
//                }

                // Надо обрезать данные, чтобы передать их дальше.
                dataReceived = dataReceived.slice(CID.CID_BYTES * 2 + 1);
            }
//            } else {
//                // Новое подключение!
//                oc = server.createConnection();
//            }

            var transport = new Transport(c);
            oc.changeTransport(transport);
            tcpServer.emit('connection', oc);

            // В любом случае отправляем обратно cid:
            c.write('@' + oc.cid);

            if (dataReceived.length > 0) {
                transport.emit('data', dataReceived);
            }
        }
    });


    this.nodeServer.listen(this.port, this.ip);
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