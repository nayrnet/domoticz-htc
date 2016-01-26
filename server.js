#!/usr/bin/nodejs
// Domoticz Home Theatre Controller (NODE-DOMOTICZ-HTC)
// NodeJS Framework for integrating Home Theatre Equipment with Domoticz.

// The default setup is my own and uses Pioneer AVR, SharpTV and PowerMate USB hardware
// Expanding it from here to suit your own hardware configuration should be straight forward.

var 	avr 		= require('./hardware/pioneeravr.js'),
	television	= require('./hardware/sharptv.js'),
//	usbknob		= require('./hardware/powermate.js'),
	mqtt            = require('node-domoticz-mqtt'),
	POWER		= false,
	MUTE		= false,
	INPUT		= false,
	TRACE		= false;


var hardware = {
	avrPort:	50000,
	avrHost:	"192.168.4.66",
	tvPort: 	"/dev/ttyUSB-TV",
	tvBaud: 	"9600",
	log: 		TRACE
};

var devices = {
	idx:		[ 145, 167, 105, 170 ],
	host:		'localhost',
        status:         'htc/connected',
	log: 		TRACE
};

// Domoticz Switches - INPUT, NAME, SWITCH IDX, LEVEL
var switches = {
	power		: [ 145, 0 ],
	volume		: 170,
	displayText	: 0,
	modeText	: 167,		
	15		: [ 145, 10, 'Nexus Player' ],
	4		: [ 145, 20, 'PlayStation 3' ],
	22		: [ 145, 30, 'PlayStation 4' ],
	24		: [ 145, 40, 'IPCameras' ]
};

// Domoticz Audio Mode Switch - MODE, NAME, SWITCH IDX, LEVEL
var modes = {
	power:		[ 'Power Off', 145, 0 ],
	15:		[ 'Nexus Player', 145, 10 ],
	4:		[ 'PlayStation 3', 145, 20 ],
	22:		[ 'PlayStation 4', 145, 30 ],
	24:		[ 'IP Cameras', 145, 40 ]
};


// Setup Hardware
var	receiver 	= new avr.Pioneer(hardware);
var	tv 		= new television.SharpTV(hardware);
var 	domoticz 	= new mqtt.domoticz(devices);
//var 	vol		= new usbknob.PowerMote(options);

// EVENTS

// OnConnect Events
receiver.on("connect", function() {
	console.log("Pioneer: connected");
	// Query Inital state slowly.
        setTimeout(function() {
                receiver.querypower()
                receiver.queryinput()
        }, 1000);
        setTimeout(function() {
                receiver.queryaudioMode()
                receiver.queryVolume()
        }, 3000);
});

domoticz.on('connect', function() {
	console.log("Domoticz MQTT: connected")
        domoticz.log('<HTC> Home Theatre Controller connected.')
});

// Domoticz: data
domoticz.on('data', function(data) {
	// Main Selector Switch
	var dev = Object.keys(switches);
	dev.forEach(function(input){
		if ((data.idx === switches[input][0]) && (switches[input][1] === parseInt(data.svalue1))) {
			if ((!isNaN(input)) && (input !== INPUT)) {
				if (TRACE) { console.log("GOT: Input " + switches[input][2]) };
				setInput(input)
				INPUT = switches[input]
			} else if ((input === 'power') && (POWER)) {
				if (TRACE) { console.log("GOT: Power Off") };
				receiver.power(0)
				POWER = false
			}
		}
	});
	if (TRACE) {
	        message = JSON.stringify(data)
	        console.log("DOMO IN: " + message.toString())
	}
});

// receiver: power
receiver.on('power', function(pwr) {
	if ((!pwr) && (POWER) && (switches['power'][0])) {
		domoticz.switch(switches['power'][0],switches['power'][1])
		if (switches[modeText]) {
			domoticz.switch(switches[modeText],"[OFF]")
		}
		domoticz.log("<HTC> Powering Down")
	}
	POWER = pwr
});

// receiver: volume
receiver.on('volume', function(val) {
	if ((POWER) && (switches['volume'])) {
		domoticz.switch(switches['volume'],val)
	}
});

// receiver: mute
receiver.on('mute', function(mute) {
	if ((POWER) && (switches['mute'])) {
		domoticz.switch(switches['mute'],mute)
		MUTE = mute
	}
});

// receiver: input
receiver.on('input', function(input,inputName) {
	if ((POWER) && (switches[input][0])) {
		domoticz.switch(switches[input][0],switches[input][1])
		domoticz.log("<HTC> input changed to " + switches[input][2])
		INPUT = input
	}
});

// receiver: listening modes
receiver.on('listeningModes', function(mode,modeName) {
	if ((POWER) && (switches['modeText'])) {
		domoticz.switch(switches['modeText'],modeName)
	}
});


// receiver: display
receiver.on('display', function(display) {
	if ((POWER) && (switches['displayText'])) {
		domoticz.switch(switches['displayText'],modeName)
	}
});

// receiver: error
receiver.on('error', function(error) {
	console.log("FATAL AVR ERROR: \r" + error)
	domoticz.log("FATAL AVR ERROR: " + error)
	process.exit()
});

// setInput - Perform tasks every input change.
function setInput(input) {
	receiver.power(1);
	tv.power(1);
	receiver.selectInput(input);
//	receiver.mute(false);
}

