#!/usr/bin/nodejs
// AVR Controller Server - Setups all the hardware and listens for external API calls.
// This is the main proccess, everything comes together in here.

var 	avr 		= require('./hardware/pioneeravr.js'),
	tele		= require('./hardware/sharptv.js'),
//	powermate	= require('./hardware/powermate.js'),
    	request 	= require('request'),
	http 		= require('http'),
    	url 		= require('url'),
	net 		= require('net');

var options = {
	// AVR Connection Settings
	port: 		50000,
	host: 		"192.168.4.66",
	// TV Port Settings
	serialport: 	"/dev/ttyUSB-TV",
	serialbaud: 	"9600",
	// Debug Logging
	log: 		true
};

// Setup Hardware
var	receiver 	= new avr.Pioneer(options);
var	tv 		= new tele.SharpTV(options);
//var 	vol		= new powermate.PowerMote(options);

// Setup Software
var 	webserver 	= http.createServer().listen(8090, 'localhost');
receiver.on("connect", function() {
	console.log("Pioneer: connected");
});

// WebServer Listen for Input Changes (Domoticz)
webserver.on('request', function(req, res) {
	var url_parts = url.parse(req.url, true);
	switch(url_parts.pathname) {
	    case '/on':
		receiver.power(1);
		tv.power(1);
		if(options.log) { console.log("HTTP-GET: /on"); }
		break;
	    case '/off':
		receiver.power(0);
		tv.power(0);
		if(options.log) { console.log("HTTP-GET: /off"); }
		break;
	    case '/muteon':
		receiver.mute(1);
		tv.mute(1);
		if(options.log) { console.log("HTTP-GET: /muteon"); }
		break;
	    case '/muteoff':
		receiver.mute(0);
		tv.mute(0);
		if(options.log) { console.log("HTTP-GET: /muteoff"); }
		break;
	    case '/ps3':
		setInput("04");		// This has to be paded with a zero as the input is 04 not 4
		if(options.log) { console.log("HTTP-GET: /ps3"); }
		break;
	    case '/ps4':
		setInput(22);
		if(options.log) { console.log("HTTP-GET: /ps4"); }
		break;
	    case '/nexus':
		setInput(15);
		if(options.log) { console.log("HTTP-GET: /nexus"); }
		break;
	    case '/ipcameras':
		setInput(24);
		if(options.log) { console.log("HTTP-GET: /ipcameras"); }
		break;
	    case '/audio-auto':
		receiver.listeningMode("0006");
		if(options.log) { console.log("HTTP-GET: /audio-auto"); }
		break;
	    case '/audio-alc':
		receiver.listeningMode("0151");
		if(options.log) { console.log("HTTP-GET: /audio-alc"); }
		break;
	    case '/audio-direct':
		receiver.listeningMode("0007");
		if(options.log) { console.log("HTTP-GET: /audio-direct"); }
		break;
	    case '/audio-stereo':
		receiver.listeningMode("0001");
		if(options.log) { console.log("HTTP-GET: /audio-stereo"); }
		break;
	    case '/audio-pl2':
		receiver.listeningMode("0012");
		if(options.log) { console.log("HTTP-GET: /audio-pl2"); }
		break;
	    case '/audio-pl2music':
		receiver.listeningMode("0014");
		if(options.log) { console.log("HTTP-GET: /audio-pl2music"); }
		break;
	    case '/audio-extstereo':
		receiver.listeningMode("0112");
		if(options.log) { console.log("HTTP-GET: /audio-extstereo"); }
		break;
	    case '/':
	      res.write('<html><body>Hello, I am the AVR Controller.</body></html>');
	      break;
	    default:
	      res.write('Unknown path: ' + JSON.stringify(url_parts));
	  }
	  res.end();
});

// Perform tasks every input change.
function setInput(input) {
	receiver.power(1);
	tv.power(1);
	receiver.selectInput(input);
//	receiver.mute(false);
}

