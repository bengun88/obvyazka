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

/**
 * Export
 */
module.exports.Connection = Connection;

/**
 * Creates new object of Connection class.
 *
 * @constructor
 * @param {Server} server Server opened this connection.
 * @this {Connection}
 */
function Connection()
{
	var connection = this;
	
	// When connection is created, it has no transport:
	connection.transport = null;
  
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
  
  /**
   * Send message (or part of message) or push to queue:
   * @param {Buffer} buf Buffer to send.
   */
  function sendBuffer( buf ) {
		if ( connection.transport ) {
			while( connection.queue.length ) {
				var msgBuf = connection.queue.shift();
				connection.transport.send( msgBuf );
			}
			connection.transport.send( buf );
		} else {
			connection.queue.push( buf );
		}
	} 

  function sendUCheck(type, str) {
     // is sending correct?
    if ( typeof( type ) !== 'string' )    throw( new Error('Obvyazka U Type is not a String') );
    if ( Buffer.byteLength(type) !== 2 )  throw( new Error('Obvyazka U Invalid length of type') );
    if ( typeof( str ) !== 'string' )     throw( new Error('Obvyazka U Str is not a String') );
    if ( Buffer.byteLength(str) > 65535 ) throw( new Error('Obvyazka U Invalid length of Str. > 65535') ); 
  }
  
  function sendU(type, str) {
    // prepare buffer:
    var buf = new Buffer( 5 + Buffer.byteLength(str) );
    buf.write( 'U' );
    buf.writeUInt16LE( Buffer.byteLength(str), 1 );
    buf.write( type, 3 );
    buf.write( str, 5 );
    sendBuffer( buf );
  };
	
  function sendRCheck(type, buf) {
    // is sending correct?
    if ( typeof( type ) !== 'string' )   throw( new Error('Obvyazka R Type is not a String') );
    if ( Buffer.byteLength(type) !== 2 ) throw( new Error('Obvyazka R Invalid length of type') );
    if ( !(buf instanceof Buffer) )      throw( new Error('Obvyazka R Buf is not a Buffer') );
    if ( buf.length > 65535 )            throw( new Error('Obvyazka R Invalid length of Buf. > 65535') );      
  }
  
  function sendR(type, buf) {
    // prepare buffers:
    var headerBuffer = new Buffer( 5 );
    headerBuffer.write( 'R' );
    headerBuffer.writeUInt16LE( buf.length, 1 );
    //console.log(type + ' ' + buf.length);
    headerBuffer.write( type, 3 );
    sendBuffer( headerBuffer );
    sendBuffer( buf );
  };  
  
  function sendJCheck(type, obj) {
    // is sending correct?
    if ( typeof( type ) !== 'string' ) throw( new Error('Obvyazka J Type is not a String') );
    if ( type.length > 65535 )         throw( new Error('Obvyazka J Invalid length of type > 65535') );
  }  
  
  function sendJ(type, obj) {
    var sendObj = {};
    sendObj[ type ] = obj;
    var str = JSON.stringify( sendObj );
    var buf = new Buffer( 5 + Buffer.byteLength(str) );
    buf.write( 'J' );
    buf.writeUInt32LE( Buffer.byteLength(str), 1 );
    buf.write( str, 5 );   
    sendBuffer( buf );
  };	

  function sendSCheck(type, str) {
     // is sending correct?
    if ( typeof( type ) !== 'string' )     throw( new Error('Obvyazka S Type is not a String') );
    if ( Buffer.byteLength(type) > 65535)  throw( new Error('Obvyazka S Invalid length of type > 65535') );
    if ( typeof( str ) !== 'string' )      throw( new Error('Obvyazka S Str is not a String') );
  }
  
  function sendS(type, str) {
    // prepare buffer:
    var buf = new Buffer( 7 + Buffer.byteLength(type) + Buffer.byteLength(str) );
    buf.write( 'S' );
    buf.writeUInt16LE( Buffer.byteLength(type), 1 );
    buf.write( type, 3 );
    buf.writeUInt32LE( Buffer.byteLength(str), 3 + Buffer.byteLength(type) );
    buf.write( str, 7 + Buffer.byteLength(type) );
    sendBuffer( buf );
  };    
  
  function sendBCheck(type, buf) {
    // is sending correct?
    if ( typeof( type ) !== 'string' )     throw( new Error('Obvyazka B Type is not a String') );
    if ( Buffer.byteLength(type) > 65535 ) throw( new Error('Obvyazka B Invalid length of type > 65535') );
    if ( !(buf instanceof Buffer) )        throw( new Error('Obvyazka B Buf is not a Buffer') );
    if ( buf.length > 2147483648 )         throw( new Error('Obvyazka B Invalid length of Buf > 2147483648') );      
  }  
  
  function sendB(type, buf) {
    // prepare buffer:
    var headerBuffer = new Buffer( 7 + Buffer.byteLength(type) );
    headerBuffer.write( 'B' );
    headerBuffer.writeUInt16LE( Buffer.byteLength(type), 1 );
    headerBuffer.write( type, 3 );
    headerBuffer.writeUInt32LE( buf.length, 3 + Buffer.byteLength(type) );
    sendBuffer( headerBuffer );
    sendBuffer( buf );
  };  

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
  
  function sendT(type, buf) {
    // prepare buffer:
    sendBuffer( new Buffer(type) );
    sendBuffer( buf );
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
  }
  
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
    }
    connection.sendR = function(type,buf) {
      connection.emit('debug', 'R', connection.cid, type, buf.toString() );
      sendRCheck(type,buf);
      sendR(type,buf);
    }
    connection.sendJ = function(type,obj) {
      connection.emit('debug', 'J', connection.cid, type, JSON.stringify(obj) );
      sendJCheck(type,obj);
      sendJ(type,obj);
    }
    connection.sendB = function(type,buf) {
      connection.emit('debug', 'B', connection.cid, type, buf.toString() );
      sendBCheck(type,buf);
      sendB(type,buf);
    }    
    connection.sendS = function(type,str) {
      connection.emit('debug', 'S', connection.cid, type, str );
      sendSCheck(type,str);
      sendS(type,str);
    }    
    connection.sendT = function(type,buf) {
      connection.emit('debug', 'T', connection.cid, type, buf.toString() );
      sendTCheck(type,buf);
      sendT(type,buf);
    }       
  }
  
  connection.disableDebug = function()
  {
    connection.sendU = sendU;
    connection.sendR = sendR;
    connection.sendJ = sendJ;
    connection.sendB = sendB;
    connection.sendS = sendS;
    connection.sendT = sendT;
  }
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
    if (self.cid) {
        console.log('deleting ' + self.cid);
        delete self.server.connections[self.cid];
    }
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
    while (self._receiveQueue.length > 0) {
        format = String.fromCharCode(self._receiveQueue.at(0));
        switch(format) {
            case 'U':
                if (self._receiveQueue.length < 5) return;
                self._receiveQueue.glueTo(5);
                //TODO: fix _list usage
                messageLength = self._receiveQueue._list[0].readUInt16LE(1);
                if (self._receiveQueue.length < 5 + messageLength) return;
                length = messageLength + 5;
                self._receiveQueue.glueTo(length);
                break;
            case 'R':
                if (self._receiveQueue.length < 5) return;
                self._receiveQueue.glueTo(5);
                messageLength = self._receiveQueue._list[0].readUInt16LE(1);
                if (self._receiveQueue.length < 5 + messageLength) return;
                length = messageLength + 5;
                self._receiveQueue.glueTo(length);
                break;
            case 'J':
                if (self._receiveQueue.length < 5) return;
                self._receiveQueue.glueTo(5);
                messageLength = self._receiveQueue._list[0].readUInt32LE(1);
                if (self._receiveQueue.length < 5 + messageLength) return;
                length = messageLength + 5;
                self._receiveQueue.glueTo(length);
                break;
            case 'B':
                if (self._receiveQueue.length < 3) return;
                self._receiveQueue.glueTo(3);
                typeLength = self._receiveQueue._list[0].readUInt16LE(1);
                if (self._receiveQueue.length < 3 + typeLength + 4) return;
                self._receiveQueue.glueTo(3 + typeLength + 4);
                messageLength = self._receiveQueue._list[0].readUInt32LE(3 + typeLength);
                if (self._receiveQueue.length < 7 + typeLength + messageLength) return;
                length = 7 + typeLength + messageLength;
                self._receiveQueue.glueTo(length);
                break;
            case 'S':
                if (self._receiveQueue.length < 3) return;
                self._receiveQueue.glueTo(3);
                typeLength = self._receiveQueue._list[0].readUInt16LE(1);
                if (self._receiveQueue.length < 3 + typeLength + 4) return;
                self._receiveQueue.glueTo(3 + typeLength + 4);
                messageLength = self._receiveQueue._list[0].readUInt32LE(3 + typeLength);
                if (self._receiveQueue.length < 7 + typeLength + messageLength) return;
                length = 7 + typeLength + messageLength;
                self._receiveQueue.glueTo(length);
                break;
            default:
                if (self._receiveQueue.length < 1 + Connection.tinySize) return;
                length = 1 + Connection.tinySize;
                self._receiveQueue.glueTo(length);
                break;
        }

        message = self._receiveQueue.cut(length);

        var res = translateMessage( format, message, typeLength, messageLength );

        self.emit(res.type,res.obj);
    }
}

/**
 *  tinySize - size of all tiny messages
 */
Connection.tinySize = 20;

/**
 *  timeout - size of timeout for hanging connections in s
 */
Connection.timeout = 2;



function translateMessage( format, message, typeLength, messageLength )
{
    var type = '';
    var str = '';
    var obj;
    switch ( format ){
        case 'U':
            str = message.toString( 'utf8', 3 );
            type = str.substr( 0, 2 );
            obj = str.substr( 2 );
            break;
        case 'R':
            type = message.toString( 'utf8', 3, 5);
            obj = message.slice( 5 );
            break;
        case 'B':
            type = message.toString( 'utf8', 3, 3 + typeLength );
            obj = message.slice( 7 + typeLength );
            break;
        case 'S':
            type = message.toString( 'utf8', 3, 3 + typeLength );
            obj = message.toString( 'utf8', 7 + typeLength );
            break;
        case 'J':
            str = message.toString( 'utf8', 5 );
            var parsedObj = JSON.parse(str);
            for (var k in parsedObj){
                type = k;
                obj = parsedObj[k];
            }
            break;
        default:
            if ((format.charCodeAt(0) < 97 ) || (format.charCodeAt(0) > 122 ) ) {
                throw new Error("Unknown message format.");
            }
            type = format;
            obj = message.slice( 1 );
    }

    return {type:type,obj:obj};
}