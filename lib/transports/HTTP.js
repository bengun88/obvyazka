var http = require('http');
var util = require('util');
var url = require('url');
var CID = require('../cid');
var Connection = require('../connection.js').Connection;
var TransportPrototype = require('../transport').Transport;
var ServerPrototype = require('../transport').Server;
var ClientTransportPrototype = require('../transport').ClientTransport;
var makeCrossdomainXML = require('../crossdomain.js').makeCrossdomainXML;

var CROSSDOMAIN_PATH = "/crossdomain.xml";
var NEW_CONNECTION_PATH = "/newConnection";

module.exports.Server = Server;
module.exports.Transport = Transport;
module.exports.Client = ClientTransport;

function Server(server, ip, port, config, openedPorts){
    var self = this;

    self.ip = ip;
    self.port = port;
    self.config = config;
//    self.openedPorts = openedPorts;
    self.obvyazkaServer = server;

    self.server = new http.Server();

    self.server.on("request",self.onRequest.bind(self));

    var items = [];
    for ( var i in self.config.domains ) {
        items.push({domain:self.config.domains[i]});
    }

    // Если домены не указаны, разрешаем доступ с любого домена:
    if (items.length === 0){
        items = [{domain:'*',ports:openedPorts[self.ip]}];
    }

    // Составляем XML кроссдоменной политики:
    self._crossdomainXML = makeCrossdomainXML(items);
}
util.inherits(Server,ServerPrototype);

Server.prototype.listen = function(){
    var self = this;
    this.server.on('listening',function(){
        self.emit('listening');
    });

    this.server.listen(this.port,this.ip);
};

Server.prototype.close = function(){
    this.server.close();
};

Server.prototype.onRequest = function(request,response){
    var self = this;

    var parsedUrl = url.parse(request.url);

    if (parsedUrl.path === CROSSDOMAIN_PATH){
        response.end(self._crossdomainXML);
    }
    else if (parsedUrl.path === NEW_CONNECTION_PATH){
        var oc = new Connection();

        self.emit( 'connection', oc );

        response.end(oc.cid,'utf8');
    }
    else if (CID.isValidCID(parsedUrl.path.slice(1))){
        var oc = new Connection();
        oc.cid = parsedUrl.path.slice(1);

        var transport = new Transport();
        oc.changeTransport( transport );
        self.emit( 'connection', oc );
        transport._onRequest(request,response);
    }
    else {
        response.statusCode = 400;
        response.end("Invalid URL",'utf8');
    }
};



function Transport(){
    this._sendQueue = [];
}
util.inherits(Transport,TransportPrototype);

Transport.prototype.send = function(buffer){
    this._sendQueue.push(buffer);
};

Transport.prototype.close = function(){
    this.emit('close');
};

Transport.prototype._onRequest = function(request,response){
    var self = this;

    request.on('data',function(chunk){
        self.emit('data',chunk);
    });

    request.on('end',function(){
        response.setHeader('Content-Type','application/octet-stream');

        for (var i=0;i<self._sendQueue.length;i++){
            response.write(self._sendQueue[i]);
        }
        self._sendQueue = [];

        self.close();
        response.end();
    });
};

function ClientTransport(options){
    this.host = options.host;
    this.port = options.port;
    this.cid = undefined;
    this.queue = [];
    this.interval = 1000;

    this.requestInterval = null;
}
util.inherits(ClientTransport,ClientTransportPrototype);

ClientTransport.prototype.connect = function(cid){
    var self = this;

    if (cid) this.cid = cid;

    if (this.cid === undefined){
        this._getCID(function(err,res){
            if (err){
                //TODO Handle errors
                throw err;
            }
            self.cid = res;
            self.emit('connect',self.cid);
        });
    }
    else{
        this._request(function(err){
            if (err){
                //TODO Handle errors
                throw err;
            }
            self.emit('connect',self.cid);
        })
    }

    self.requestInterval = setInterval(self._request.bind(self),self.interval);
};

ClientTransport.prototype.close = function(){
    clearInterval(this.requestInterval);
};

ClientTransport.prototype.send = function(buf){
    this.queue.push(buf);
};

ClientTransport.prototype._getCID = function(cb){
    var self = this;

    var cbCalled = false;
    function cbOnce(){
        if (cbCalled) return;
        cb.apply(null,arguments);
        cbCalled = true;
    }

    var options = {
        hostname:this.host,
        port:this.port,
        path:NEW_CONNECTION_PATH,
        method:'POST'
    };

    var req = http.request(options,function(res){
        var data = "";
        res.on('data', function (chunk) {
            data+=chunk;
        });
        res.on('end',function(){
            var err = null;
            if (res.statusCode != 200){
                err = new Error("Bad status code from server: " + res.statusCode);
            }
            cbOnce(err,data);
        });
    });

    req.on('error',cbOnce);

    req.end();
};

ClientTransport.prototype._request = function(cb){
    var self = this;

    var cbCalled = false;
    function cbOnce(){
        if (cbCalled) return;
        if (cb === undefined) return;
        cb.apply(null,arguments);
        cbCalled = true;
    }

    var options = {
        hostname:this.host,
        port:this.port,
        path:'/'+this.cid,
        method:'POST'
    };

    var req = http.request(options,function(res){
        var err = null;
        if (res.statusCode != 200){
            err = new Error("Bad status code from server: " + res.statusCode);
        }
        cbOnce(err);

        res.on('data', function (chunk) {
            self.emit('data',chunk);
        });
    });

    req.on('error',cbOnce);

    for (var i=0;i<self.queue.length;i++){
        req.write(self.queue[i]);
    }
    self.queue = [];

    req.end();
};