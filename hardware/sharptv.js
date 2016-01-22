#!/usr/bin/nodejs
// Sharp Aquos TV - HDMI CEC for TV power does not work, so lets use a serial connection.
// Power/Mute functionality only.

var 	serialport = require("serialport"),
	events = require('events'),
	util   = require('util');

var TRACE = false;
var PORT;

var SharpTV = function(options) {
	events.EventEmitter.call(this); // inherit from EventEmitter
    	TRACE = options.log;
    	PORT = options.serial;
}

util.inherits(SharpTV, events.EventEmitter);

var SerialPort = serialport.SerialPort; // localize object constructor 
var sp = new SerialPort('/dev/ttyUSB-TV', {
	baudrate: 9600,
	parser: serialport.parsers.readline("\r")
});
// Connect
sp.on('open', function() {
	console.log('SharpTV: connected @ ' + sp.options.baudRate);
	setTimeout(function() {
		sp.write("RSPW1   \r");	// Disable energy saving mode.
	}, 1000);
});

sp.on("data", function (data) {
	if(TRACE) {
	  	console.log("SharpTV GET: "+data);
	}
});

SharpTV.prototype.power = function(value) {
	sp.write("POWR" + value + "   \r");
	if(TRACE) {
		console.log("SharpTV SEND: POWR" + value + "\r");
	}
}

SharpTV.prototype.mute = function(value) {
	sp.write("MUTE" + value + "   \r");
	if(TRACE) {
		console.log("SharpTV SEND: MUTE" + value + "\r");
	}
}

exports.SharpTV = SharpTV;
