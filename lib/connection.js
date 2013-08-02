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
var util       = require('util');
var Transport = require('./transport').Transport;
var BufferList = require('./bufferlist.js');
var Parser = require('./parser.js');

/**
 * Export
 */
module.exports.Connection = Connection;

/**
 * Creates new object of Connection class.
 *
 * @constructor
 * @this {Connection}
 */
function Connection()
{
	var connection = this;
	
	// When connection is created, it has no transport:
	connection.transport = null;


    connection.cid = null;
  
	// Logic of connection:
	// Each connection have queue of undelivered messages. If transport is available,
  // connection send all messages from queue and any new messages. If is not,
  // new messages added to queue.
	connection.queue = [];

  ////////////////////////////////////////////////
  //                                            //
  //               SENDING DATA:                //
  //                                            //
	////////////////////////////////////////////////
  
  function sendU(type, str) {
    // prepare buffer:
    var buf = new Buffer( 5 + Buffer.byteLength(str) );
    buf.write( 'U' );
    buf.writeUInt16LE( Buffer.byteLength(str), 1 );
    buf.write( type, 3 );
    buf.write( str, 5 );
    connection._sendBuffer( buf );
  }
	
  function sendR(type, buf) {
    // prepare buffers:
    var headerBuffer = new Buffer( 5 );
    headerBuffer.write( 'R' );
    headerBuffer.writeUInt16LE( buf.length, 1 );
    //console.log(type + ' ' + buf.length);
    headerBuffer.write( type, 3 );
      connection._sendBuffer( headerBuffer );
      connection._sendBuffer( buf );
  }
  
  function sendJ(type, obj) {
    var sendObj = {};
    sendObj[ type ] = obj;
    var str = JSON.stringify( sendObj );
    var buf = new Buffer( 5 + Buffer.byteLength(str) );
    buf.write( 'J' );
    buf.writeUInt32LE( Buffer.byteLength(str), 1 );
    buf.write( str, 5 );
      connection._sendBuffer( buf );
  }

  function sendS(type, str) {
    // prepare buffer:
    var buf = new Buffer( 7 + Buffer.byteLength(type) + Buffer.byteLength(str) );
    buf.write( 'S' );
    buf.writeUInt16LE( Buffer.byteLength(type), 1 );
    buf.write( type, 3 );
    buf.writeUInt32LE( Buffer.byteLength(str), 3 + Buffer.byteLength(type) );
    buf.write( str, 7 + Buffer.byteLength(type) );
      connection._sendBuffer( buf );
  }
  
  function sendB(type, buf) {
    // prepare buffer:
    var headerBuffer = new Buffer( 7 + Buffer.byteLength(type) );
    headerBuffer.write( 'B' );
    headerBuffer.writeUInt16LE( Buffer.byteLength(type), 1 );
    headerBuffer.write( type, 3 );
    headerBuffer.writeUInt32LE( buf.length, 3 + Buffer.byteLength(type) );
      connection._sendBuffer( headerBuffer );
      connection._sendBuffer( buf );
  }

  function sendT(type, buf) {
    // prepare buffer:
      connection._sendBuffer( new Buffer(type) );
      connection._sendBuffer( buf );
  }
  
  connection.send = function(type,obj)
  {
    // Deal with string?
    if (typeof obj == 'string') {
      if ((obj.length < 65536)&&(Buffer.byteLength(type)==2)) {
        connection.sendU(type,obj);
      } else {
        connection.sendS(type,obj);
      }
    // Deal with buffer?
    } else if (obj instanceof Buffer) {
      if ((obj.length < 65536)&&(Buffer.byteLength(type)==2)) {
        connection.sendR(type,obj);
      } else if (
        ( obj.length == Connection.tinySize ) && ( Buffer.byteLength(type) == 1 ) &&
        ( type.charCodeAt(0) >= 97 ) && ( type.charCodeAt(0) <= 122 )
        ) {
        connection.sendT(type,obj);
      } else {
        connection.sendB(type,obj);
      }
    // Other objects => send JSON
    } else {
      connection.sendJ(type,obj);
    }
  };
  
  ////////////////////////////////////////////////
  //                                            //
  //               RECEIVING DATA:              //
  //                                            //
	////////////////////////////////////////////////  

    connection._receiveQueue = new BufferList();

  ////////////////////////////////////////////////
  //                                            //
  //               DEBUG MODE:                  //
  //                                            //
	////////////////////////////////////////////////    
  connection.enableDebug = function()
  {
    connection.sendU = function(type,str) {
      connection.emit('debug', 'U', connection.cid, type, str );
      sendUCheck(type,str);
      sendU(type,str);
    };
    connection.sendR = function(type,buf) {
      connection.emit('debug', 'R', connection.cid, type, buf.toString() );
      sendRCheck(type,buf);
      sendR(type,buf);
    };
    connection.sendJ = function(type,obj) {
      connection.emit('debug', 'J', connection.cid, type, JSON.stringify(obj) );
      sendJCheck(type,obj);
      sendJ(type,obj);
    };
    connection.sendB = function(type,buf) {
      connection.emit('debug', 'B', connection.cid, type, buf.toString() );
      sendBCheck(type,buf);
      sendB(type,buf);
    };
    connection.sendS = function(type,str) {
      connection.emit('debug', 'S', connection.cid, type, str );
      sendSCheck(type,str);
      sendS(type,str);
    };
    connection.sendT = function(type,buf) {
      connection.emit('debug', 'T', connection.cid, type, buf.toString() );
      sendTCheck(type,buf);
      sendT(type,buf);
    }       
  };
  
  connection.disableDebug = function()
  {
    connection.sendU = sendU;
    connection.sendR = sendR;
    connection.sendJ = sendJ;
    connection.sendB = sendB;
    connection.sendS = sendS;
    connection.sendT = sendT;
  };
  connection.disableDebug();  
}
util.inherits(Connection, events.EventEmitter);

Connection.prototype.end = function()
{
    var self = this;
    console.log('o2c end');
    if (self.transport) {
        self.transport.close();
        self.transport.removeAllListeners();
    }

    console.log('deleting ' + self.cid);
    console.log('o2c emit close');
    self.emit('close');
    self.removeAllListeners();
};

Connection.prototype.changeTransport = function ( transport ) {
    var self = this;

    console.log('o2c changeTransport');
    if ( !( transport instanceof Transport ) ) throw new Error('Changing transport to not-Transport object.');

    if ( self.transport ) {
        self.transport.removeAllListeners();
        self.transport.close();
    }

    self.transport = transport;
    transport.on('data', self._translateData.bind(self));
    transport.on('close', function() {
        // Remove all links to transports:
        if (self.transport === transport) {
            self.transport.removeAllListeners();
            self.transport.close();
            self.transport = null;
        } else {
            transport.removeAllListeners();
        }
        // Start timeout:
        console.log('o2c timeout start');
        if (self.transport === null) {
            self.timeout = Connection.timeout*1000 + new Date().getTime();
        }
    });
};

Connection.prototype._translateData = function( dataReceived ) {
    var self = this;

    if (dataReceived.length === 0) return;

    var data;
    if (typeof dataReceived === 'string') {
        data = new Buffer(dataReceived,'utf8');
    } else {
        data = dataReceived;
    }
    self._receiveQueue.push(data);
    self._translateMessageCycle();
};

Connection.prototype._translateMessageCycle = function() {
    var self = this;

    var format = '';
    var length = 0;
    var typeLength = 0;
    var messageLength = 0;
    var message = new Buffer(0);

    var type;
    var data;
    while (self._receiveQueue.length > 0) {
        format = String.fromCharCode(self._receiveQueue.at(0));
        switch(format) {
            case 'U':
            case 'R':
            case 'S':
            case 'B':
                var res = Connection.parsers[format].parse(self._receiveQueue);
                if (! res) return;
                type = res.results.type;
                data = res.results.data;
                break;
            case 'J':
                var res = Connection.parsers[format].parse(self._receiveQueue);
                if (! res) return;
                for (var k in res.results.data){
                    type = k;
                    data = res.results.data[k];
                }
                break;
            default:
                var res = Connection.parsers['?'].parse(self._receiveQueue);
                if (! res) return;
                type = res.results.type;
                data = res.results.data;
                break;
        }

        self._receiveQueue.splice(0,res.totalSize);

        self.emit(type,data);
    }
};

/**
 * Send message (or part of message) or push to queue:
 * @param {Buffer} buf Buffer to send.
 */
Connection.prototype._sendBuffer = function( buf ) {
    var connection = this;

    if ( connection.transport ) {
        while( connection.queue.length ) {
            var msgBuf = connection.queue.shift();
            connection.transport.send( msgBuf );
        }
        connection.transport.send( buf );
    } else {
        connection.queue.push( buf );
    }
};

function sendUCheck(type, str) {
    // is sending correct?
    if ( typeof( type ) !== 'string' )    throw( new Error('Obvyazka U Type is not a String') );
    if ( Buffer.byteLength(type) !== 2 )  throw( new Error('Obvyazka U Invalid length of type') );
    if ( typeof( str ) !== 'string' )     throw( new Error('Obvyazka U Str is not a String') );
    if ( Buffer.byteLength(str) > 65535 ) throw( new Error('Obvyazka U Invalid length of Str. > 65535') );
}

function sendRCheck(type, buf) {
    // is sending correct?
    if ( typeof( type ) !== 'string' )   throw( new Error('Obvyazka R Type is not a String') );
    if ( Buffer.byteLength(type) !== 2 ) throw( new Error('Obvyazka R Invalid length of type') );
    if ( !(buf instanceof Buffer) )      throw( new Error('Obvyazka R Buf is not a Buffer') );
    if ( buf.length > 65535 )            throw( new Error('Obvyazka R Invalid length of Buf. > 65535') );
}

function sendJCheck(type, obj) {
    // is sending correct?
    if ( typeof( type ) !== 'string' ) throw( new Error('Obvyazka J Type is not a String') );
    if ( type.length > 65535 )         throw( new Error('Obvyazka J Invalid length of type > 65535') );
}

function sendSCheck(type, str) {
    // is sending correct?
    if ( typeof( type ) !== 'string' )     throw( new Error('Obvyazka S Type is not a String') );
    if ( Buffer.byteLength(type) > 65535)  throw( new Error('Obvyazka S Invalid length of type > 65535') );
    if ( typeof( str ) !== 'string' )      throw( new Error('Obvyazka S Str is not a String') );
}

function sendBCheck(type, buf) {
    // is sending correct?
    if ( typeof( type ) !== 'string' )     throw( new Error('Obvyazka B Type is not a String') );
    if ( Buffer.byteLength(type) > 65535 ) throw( new Error('Obvyazka B Invalid length of type > 65535') );
    if ( !(buf instanceof Buffer) )        throw( new Error('Obvyazka B Buf is not a Buffer') );
    if ( buf.length > 2147483648 )         throw( new Error('Obvyazka B Invalid length of Buf > 2147483648') );
}

function sendTCheck(type, buf) {
    // is sending correct?
    if ( typeof( type ) !== 'string' )       throw( new Error('Obvyazka TINY Type is not a String') );
    if ( Buffer.byteLength(type) !== 1 )      throw( new Error('Obvyazka TINY Invalid length of type != 1') );
    if ( 'URJBS'.indexOf(type) !== -1 )       throw( new Error('Obvyazka TINY Invalid type. Disambiguation with basic types (URJBS).') );
    if ( type.charCodeAt(0) < 97 )           throw( new Error('Obvyazka TINY Invalid type. You can use only a..z types.') );
    if ( type.charCodeAt(0) > 122 )          throw( new Error('Obvyazka TINY Invalid type. You can use only a..z types.') );
    if ( !(buf instanceof Buffer) )          throw( new Error('Obvyazka TINY Buf is not a Buffer') );
    if ( buf.length != Connection.tinySize ) throw( new Error('Obvyazka TINY Invalid length of Buf > 2147483648') );
}

/**
 *  tinySize - size of all tiny messages
 */
Connection.tinySize = 20;

/**
 *  timeout - size of timeout for hanging connections in s
 */
Connection.timeout = 2;

Connection.messageFormats = {
    'U':[
        {name:'format',type:"const",   size:1},
        {name:'len',   type:"uint16le"},
        {name:'type',  type:"string",  size:2},
        {name:'data',  type:"string",  sizeRef:'len'}
    ],
    'R':[
        {name:'format',type:"const",   size:1},
        {name:'len',   type:"uint16le"},
        {name:'type',  type:"string",  size:2},
        {name:'data',  type:"buffer",  sizeRef:'len'}
    ],
    'S':[
        {name:'format', type:"const",   size:1},
        {name:'typeLen',type:"uint16le"},
        {name:'type',   type:"string",  sizeRef:'typeLen'},
        {name:'dataLen',type:"uint32le"},
        {name:'data',   type:"string",  sizeRef:'dataLen'}
    ],
    'B':[
        {name:'format', type:"const",   size:1},
        {name:'typeLen',type:"uint16le"},
        {name:'type',   type:"string",  sizeRef:'typeLen'},
        {name:'dataLen',type:"uint32le"},
        {name:'data',   type:"buffer",  sizeRef:'dataLen'}
    ],
    'J':[
        {name:'format',type:"const",   size:1},
        {name:'len',   type:"uint32le"},
        {name:'data',  type:"object",  sizeRef:'len'}
    ],
    '?':[
        {name:'type',  type:"string",   size:1},
        {name:'data',  type:"buffer",   size:Connection.tinySize}
    ]
};

Connection.parsers = {};
for (var f in Connection.messageFormats){
    Connection.parsers[f] = new Parser(Connection.messageFormats[f]);
}