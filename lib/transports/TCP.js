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
    
		function firstRequestListener( dataReceived )
		{
			var stringReceived = dataReceived.toString();
			if( /policy-file-request/.test( stringReceived ) )
			{
				// ���������� XML ������������� ��������:
				var crossDomainStrings = "";
				for ( var i in tcpServer.config.domains ) {
					crossDomainStrings += '<allow-access-from domain="' + tcpServer.config.domains[i] + '" to-ports="'+ openedPorts[tcpServer.ip].join() + '"/>';
				}
				// ���� ������ �� �������, ��������� ������ � ������ ������:
				if ( domains.length == 0) {
					crossDomainStrings = '<allow-access-from domain="*" to-ports="'+ openedPorts[tcpServer.ip].join() + '"/>';
				}
				
				// �������� XML � ��������� �����:
				c.end ( 
						'<?xml version="1.0" encoding="UTF-8"?>' +
						'<!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd">' +
						'<cross-domain-policy>'+
							crossDomainStrings 	
						+'</cross-domain-policy>'
				);
        // ���� ����� ��������� ��� ���:
        c.once('data',firstRequestListener);
				return;
			// ����� - ��������� HELO-�����:
			} else if ( tcpServer.config.helo != "" ) {
        // Wrong helo?
				if ( (stringReceived.length < tcpServer.config.helo.length) 
					|| ( stringReceived.substr( 0, tcpServer.config.helo.length) != tcpServer.config.helo ) ) {
					c.end("WRONG HELO");
					return;
				}
				
				// ���� HELO ������� �� ������ �������� ������, ����� �������� �� ������.
				dataReceived = dataReceived.slice( Buffer.byteLength( stringReceived.substr( 0, tcpServer.config.helo.length ) ) );
			}
			
			stringReceived = dataReceived.toString();
			
			// ������� - � ����� ��� ���������������?
			if ( ( stringReceived.length > 0 ) 
				&& ( stringReceived.substr(0,1) === '@' ) )	{
				// ����� cid:
				cid = stringReceived.substr(1, 44);
				
				// ������ - ���� �� ����� ��� � ������ �2-���������.
        var oc = server.getConnectionByCid[cid]
				if ( oc === undefined ) {
					c.end('SID EXPIRED OR INVALID');
					return;
				}
				
				// ���� �������� ������, ����� �������� �� ������.
				dataReceived = dataReceived.slice( 45 );
			  
				process.nextTick( function() {	
					oc.emit( 'transportChanged' );
				});
			} else {
				// ����� �����������!	
				oc = server.createConnection();
			}
    
			// � ����� ������ ���������� ������� cid:
      c.write('@' + oc.cid);    
    
      var transport = new Transport( c );
      oc.changeTransport( transport );
      
      if (dataReceived.length > 0) {
        transport.emit('data', dataReceived);
      }
    }      
  });
}

 /**
 * Transport
 */
function Transport( c ) {
  var transport = this;
  
  transport.send = function( bufferToSend ) {
    c.write( bufferToSend )
  }
  
  transport.close = function() {
    c.removeAllListeners();
    c.end();
  }

  c.on('data', function( data ) {
    transport.emit('data', data);
  });  
  
  c.on('close', function( ) {
    transport.emit('close');
  });    
}
util.inherits(Transport, TransportPrototype);