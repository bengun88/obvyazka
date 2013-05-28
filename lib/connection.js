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
function Connection( server )
{
	var connection = this;
	
	// When connection is created, it has no transport:
	connection.transport = null;
  
	// Logic of connection:
	// Each connection have queue of undelivered messages. If transport is available,
  // connection send all messages from queue and any new messages. If is not,
  // new messages added to queue.
	connection.queue = [];

  connection.end = function()
  {
    console.log('o2c end');
    if (connection.transport) {
      connection.transport.close();
      connection.transport.removeAllListeners();
    }
    
    console.log('deleting ' + connection.cid);
    if (connection.cid) {
      console.log('deleting ' + connection.cid);
      delete connection.server.connections[connection.cid];
    }
    console.log('o2c emit close');     
    connection.emit('close');
    connection.removeAllListeners();
  }
  
  connection.changeTransport = function ( transport ) {
    console.log('o2c changeTransport');
    if ( !( transport instanceof Transport ) ) throw new Error('Changing transport to not-Transport object.');
    
    if ( connection.transport ) {
      connection.transport.removeAllListeners();
      connection.transport.close();
    }
    
    connection.transport = transport;
    transport.on('data', translateData );
    transport.on('close', function() {
      // Remove all links to transports:
      if (connection.transport === transport) {
        connection.transport.removeAllListeners();
        connection.transport.close();        
        connection.transport = null;
      } else {
        transport.removeAllListeners();
      }
      // Start timeout:
      console.log('o2c timeout start');
      if (connection.transport === null) {
        connection.timeout = Connection.timeout*1000 + new Date().getTime();
      }
    });
  };
  
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
  };
  
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

  var receiveBuffer = new Buffer(0);
  
  function translateData( dataReceived ) {
    var data;
    if (typeof dataReceived === 'string') {
      data = new Buffer(dataReceived,'utf8');
    } else {
      data = dataReceived;
    }
    receiveBuffer = Buffer.concat([receiveBuffer,data],receiveBuffer.length+data.length);
    translateMessageCycle();							
  }
  
  function translateMessageCycle() {
    var format = '';
    var length = 0;
    var typeLength = 0;
    var messageLength = 0;
    var message = new Buffer(0);
    while (receiveBuffer.length > 0) {
      format = receiveBuffer.toString('utf8',0,1);
      switch(format) {
        case 'U':
          if (receiveBuffer.length < 5) return;
          messageLength = receiveBuffer.readUInt16LE(1);
          if (receiveBuffer.length < 5 + messageLength) return;
          length = messageLength + 5;
          break;
        case 'R':
          if (receiveBuffer.length < 5) return;
          messageLength = receiveBuffer.readUInt16LE(1);
          if (receiveBuffer.length < 5 + messageLength) return;
          length = messageLength + 5;        
          break;          
        case 'J':
          if (receiveBuffer.length < 5) return;
          messageLength = receiveBuffer.readUInt32LE(1);
          if (receiveBuffer.length < 5 + messageLength) return;
          length = messageLength + 5;        
          break;
        case 'B':
          if (receiveBuffer.length < 3) return;
          typeLength = receiveBuffer.readUInt16LE(1);
          if (receiveBuffer.length < 3 + typeLength + 4) return;
          messageLength = receiveBuffer.readUInt32LE(3 + typeLength);
          if (receiveBuffer.length < 7 + typeLength + messageLength) return;
          length = 7 + typeLength + messageLength;        
          break;          
        case 'S':
          if (receiveBuffer.length < 3) return;
          typeLength = receiveBuffer.readUInt16LE(1);
          if (receiveBuffer.length < 3 + typeLength + 4) return;
          messageLength = receiveBuffer.readUInt32LE(3 + typeLength);
          if (receiveBuffer.length < 7 + typeLength + messageLength) return;
          length = 7 + typeLength + messageLength;
          break;
        default:
          if (receiveBuffer.length < 1 + Connection.tinySize) return;
          length = 1 + Connection.tinySize;        
          break;
      }
      message = receiveBuffer.slice( 0, length );
      receiveBuffer = receiveBuffer.slice( length );

      translateMessage( format, message, typeLength, messageLength );
    }
  }

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
        break
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
          var error = new Error("Unknown message format.");
          throw error;          
          return;
        }
        type = format;
        obj = message.slice( 1 );
    }
    connection.emit(type, obj);
  }  
  
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

/**
 *  tinySize - size of all tiny messages
 */
Connection.tinySize = 20;

/**
 *  timeout - size of timeout for hanging connections in s
 */
Connection.timeout = 2;