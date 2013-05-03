Obvyazka 2
==========

Intsallation
------------

	npm install obvyazka

Usage
-----

	var o = require('obvyazka');
	var server = o.createServer( function(oc) {
	  oc.on('auth', function(authObj) {
	    if (checkLoginToken(authObj.uid, authObj.token)) {
          oc.on('action', actionHandler);
	    } else {
		  oc.send('authError', {});
		  oc.close();
		}
	  });
	});
	server.listen([ 
			{type:"TCP", ip:"192.234.15.1", port:"443"},
			{type:"TCP", ip:"192.234.15.1", port:"8080"},
			{type:"TCP", ip:"192.234.15.2", port:"80"},
			{type:"TCP", ip:"192.234.15.2", port:"8080"},
			{type:"TCP", ip:"192.234.15.2", port:"443"},
			{type:"HTTP", ip:"192.234.15.3", port:"80"}
	]);	

About
-----

This is second version of Obvyazka. So all entities we call with prefix o2. For example, o2-server, o2-connection, o2-transport etc.

Main purpose of Obvyazka is comfortable work with sockets in multiplayer games. But you can use it in other apps. Obvyazka is library that allows you to use one universal o2-server and works with o2-connection instead a set of different TCP- and HTTP-servers. Obvyazka can safely reopen sockets and fall back to HTTP-requests, if sockets are not available. Obvyazka deals with messages, not bytes and sockets, so you can forget about fragmenting and defragmenting data in 'data' events.
	
Inside of Obvyazka:	
-------------------

When you are using send(type, msg), all messages translates in some series of bytes with header, length of message, type of serialization etc. There are 6 different type of message transfer in Obvyazka. This info is usefull, when you works with huge number of messages and economy in header size and data representation is critical for perfomance.

Other application of this info is writing your own Obvyazka-client on other languages. Right now you can use AS3-client code.
	
### Types of messages and format in bytes:

#### Small messages:

U - UTF-string < 65536 bytes. Type of message - 2 chars.

    [U][LN][TY][ DATA              ....   ]
	
	U    = 1 byte.   'U' character.
	LN   = 2 bytes.  Length of DATA sector. Short (16 bit) unsigned int. LSB.
	TY   = 2 bytes.  Type of message.
	DATA = LN bytes. UTF-String
	
R - RAW. Byte array < 65536 bytes. Type of message - 2 chars.

    [R][LN][TY][ DATA              ....   ]
	
	R    = 1 byte.   'R' character.
	LN   = 2 bytes.  Length of DATA sector. Short (16 bit) unsigned int. LSB.
	TY   = 2 bytes.  Type of message.
	DATA = LN bytes. Binary data.

#### Typical messages:

S - UTF-string < 2Gb. Type of message - any string.

    [S][LT][TYPE ... ][LENG][ DATA              ....   ]
	
	S      = 1 byte.   'S' character.
	LT     = 2 bytes.  Length of type. Short (16 bit) unsigned int. LSB.
	TYPE   = LT bytes. Type of message.
	LENGN  = 4 bytes.  Length of DATA sector. 32-bit unsigned int. LSB.
	DATA   = LN bytes. UTF-String.
	
J - JSON-string < 2Gb. Type of message - any string.

    [J][LT][TYPE ... ][LENG][ DATA              ....   ]
	
	J      = 1 byte.   'J' character.
	LT     = 2 bytes.  Length of type. Short (16 bit) unsigned int. LSB.
	TYPE   = LT bytes. Type of message.
	LENGN  = 4 bytes.  Length of DATA sector. 32-bit unsigned int. LSB.
	DATA   = LN bytes. UTF-String with JSON.
	
B - BIGBINARY. Byte array < 2Gb. Type of message - any string.

    [B][LT][TYPE ... ][LENG][ DATA              ....   ]
	
	B      = 1 byte.   'B' character.
	LT     = 2 bytes.  Length of type. Short (16 bit) unsigned int. LSB.
	TYPE   = LT bytes. Type of message.
	LENGN  = 4 bytes.  Length of DATA sector. 32-bit unsigned int. LSB.
	DATA   = LN bytes. Binary data.

#### Tiny messages (no header):

a..z - SMALL messages. Length is fixed for all tiny messages.

    [?][ DATA         ....   ]
	
	?    = 1 byte.   'a' .. 'z' character. This is a type of message.
	DATA = 20 bytes. Binary data. Default length is 20 bytes. But you can change this value in server settings.