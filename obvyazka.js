/**
*
* 		OBVYAZKA
*
*		cheshkov/prograess
*		myachin/prograess
*
*/

var events = require('events'); 

//
//	Глобальный объект списков портов и ip.
//	Для кроссдоменной политики. Содержит списки портов для каждого ip:
//	{ "1.2.3.4": [80,81,82], "1.2.3.5": [8080,8090] }
//	Поля заполняются при добавлении нового транспорта.
//
var openedPorts = {};

var defaultCheckingTimeout = 20000;

//
// createO2Server() -	вызывает конструктор O2Server'a
//						возвращает объект сервера.
//
function createO2Server(  )
{
	return new require('o2s.js').O2Server;
}

//
// Экспортируем нужные функции:
//
module.exports.createO2Server = createO2Server;
module.exports.defaultCheckingTimeout = defaultCheckingTimeout;