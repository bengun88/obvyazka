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
var TransportPrototype = require('../transport').Transport;
var util               = require('util');
var net                = require('net');
var events = require('events');
 
 /**
 * Export
 */
module.exports.Server = Server;
module.exports.Transport = Transport;

 /**
 * Server
 */
function Server( server, ip, port, config, openedPorts ) {
  // copy params:
  
  var tcpServer    = this;
  tcpServer.type   = 'TCP';
  tcpServer.ip     = ip;
  tcpServer.port   = port;
  tcpServer.config = JSON.parse( JSON.stringify(config) );
  
  // create server:
  tcpServer.nodeServer = new net.Server();
  tcpServer.nodeServer.listen( port, ip );
  tcpServer.listening = false;

	tcpServer.nodeServer.on( 'listening', function() {
		tcpServer.listening = true;	
		tcpServer.emit( 'debug', 'Listening on ' + ip + ':' + port );
	});

	tcpServer.nodeServer.on( 'close', function() {
		tcpServer.emit( 'debug', 'Server closed (' + ip + ':' + port + ')' );
	});

	tcpServer.nodeServer.on( 'error', function( e ) {
    tcpServer.emit( 'debug', 'Error occured: ' + e + ' on\n ' + e.stack );
	});  
  
  tcpServer.nodeServer.on( 'connection', function(c) {
		tcpServer.emit( 'debug', 'New connection (' +c.remoteAddress + ':' + c.remotePort + '-' + c.localAddress + ':' + c.localPort + ')' );
		
		c.once('data',firstRequestListener);
		//c.on('data',function(data){console.log('(' +c.remoteAddress + ':' + c.remotePort + '-' + c.localAddress + ':' + c.localPort + ') > ' + data.toString() )});
    
		function firstRequestListener( dataReceived )
		{
			var stringReceived = dataReceived.toString();
      // PI-PO ответчик для определения самого быстрого линка - попробуем сделать через хело
      //if( stringReceived === 'PI' ) {
      //  c.write('PO');
      // c.once('data',firstRequestListener);
		  // return;
      //}
			if( /policy-file-request/.test( stringReceived ) ) {
				// Составляем XML кроссдоменной политики:
				var crossDomainStrings = "";
				for ( var i in tcpServer.config.domains ) {
					crossDomainStrings += '<allow-access-from domain="' + tcpServer.config.domains[i] + '" to-ports="'+ openedPorts[tcpServer.ip].join() + '"/>';
				}
				// Если домены не указаны, разрешаем доступ с любого домена:
				if ( tcpServer.config.domains.length == 0) {
					crossDomainStrings = '<allow-access-from domain="*" to-ports="'+ openedPorts[tcpServer.ip].join() + '"/>\n';
				}
				
        console.log(						'<?xml version="1.0" encoding="UTF-8"?>' +
						'<!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd">' +
						'<cross-domain-policy>'+
							crossDomainStrings 	
						+'</cross-domain-policy>');
        
				// Посылаем XML и закрываем сокет:
				c.end ( 
						'<?xml version="1.0" encoding="UTF-8"?>' +
						'<!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd">' +
						'<cross-domain-policy>'+
							crossDomainStrings 	
						+'</cross-domain-policy>'
				);
        // Надо будет послушать еще раз:
        c.once('data',firstRequestListener);
				return;
			// Иначе - проверяем HELO-фразу:
			} else if ( tcpServer.config.helo != "" ) {
        // Wrong helo?
				if ( (stringReceived.length < tcpServer.config.helo.length) 
					|| ( stringReceived.substr( 0, tcpServer.config.helo.length) != tcpServer.config.helo ) ) {
					c.end("WRONG HELO");
					return;
				}
				
				// Если HELO подошел мы должны обрезать данные, чтобы передать их дальше.
				dataReceived = dataReceived.slice( Buffer.byteLength( stringReceived.substr( 0, tcpServer.config.helo.length ) ) );
			}
			
			stringReceived = dataReceived.toString();
			
			// Смотрим - а вдруг это переподключение?
			if ( ( stringReceived.length > 0 ) 
				&& ( stringReceived.substr(0,1) === '@' ) )	{
				// Берем cid:
				cid = stringReceived.substr(1, 44);
				
				// Чекаем - есть ли такой сид в списке о2-коннекций.
        var oc = server.getConnectionByCid[cid];
				if ( oc === undefined ) {
          oc = server.createConnection();
				} else {
          process.nextTick( function() {	
            oc.emit( 'transportChanged' );
          });        
        }
        
				// Надо обрезать данные, чтобы передать их дальше.
				dataReceived = dataReceived.slice( 45 );
			} else {
				// Новое подключение!	
				oc = server.createConnection();
			}
    
			// В любом случае отправляем обратно cid:
      c.write('@' + oc.cid);    
    
      c.setNoDelay();
      var transport = new Transport( c );
      oc.changeTransport( transport );
      tcpServer.emit( 'connection', oc );
      
      if (dataReceived.length > 0) {
        transport.emit('data', dataReceived);
      }
    }      
  });
  
  tcpServer.close = function(){
    tcpServer.nodeServer.close();
  }
}
util.inherits(Server, events.EventEmitter);

 /**
 * Transport
 */
function Transport( c ) {
  var transport = this;
  var closed = false;  
  
  transport.remoteAddress = c.remoteAddress;
  transport.send = function( bufferToSend ) {
    try {
      c.write( bufferToSend )
    } catch (err) {
      console.log('c -> error writing socket');
      if (!closed) {
        closed = true;
        transport.emit('close');
      }      
    }
  }
  
  transport.close = function() {
    console.log('c -> force closing');
    transport.removeAllListeners();
    c.removeAllListeners();
    c.end();
    c.destroy();
    closed = true;
    transport.emit('close');
  }

  c.on('data', function( data ) {
    transport.emit('data', data);
  });  
  
  c.on('close', function( ) {
    console.log('c -> rcvd close');
    if (!closed) {
      closed = true;
      transport.emit('close');
    }
  });    
}
util.inherits(Transport, TransportPrototype);