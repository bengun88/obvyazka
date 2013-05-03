Obvyazka
version 2
========

Main purpose of Obvyazka is comfortable work with sockets in multiplayer games. But you can use it in other apps. Obvyazka is library that allows you to use one universal o2-server and works with o2-connection instead a set of different TCP- and HTTP-servers. Obvyazka can safely reopen sockets and fall back to HTTP-requests, if sockets are not available. Obvyazka deals with messages, not bytes and sockets, so you can forget about fragmenting and defragmenting data in 'data' events.

Example:

	var o = require('obvyazka');
	var server = o.createServer( function(oc) {
	  oc.on('auth', function(authObj) {
	    if (checkLoginToken(authObj.login, authObj.password)) {
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

