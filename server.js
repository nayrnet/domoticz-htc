#!/usr/bin/nodejs
// Domoticz Home Theatre Controller (DOMOTICZ-HTC)
// NodeJS Framework for integrating Home Theatre Equipment with Domoticz.

// The default setup is my own and uses Pioneer AVR, SharpTV and PowerMate USB hardware
// Expanding it from here to suit your own hardware configuration should be straight forward.

var 	avr 		= require('./hardware/pioneeravr.js'),
	television	= require('./hardware/sharptv.js'),
//	usbknob		= require('./hardware/powermate.js'),
	mqtt            = require('node-domoticz-mqtt'),
	TRACE		= false;

var options = {
	avrPort: 	50000,
	avrHost: 	"192.168.4.66",
	tvPort: 	"/dev/ttyUSB-TV",
	tvBaud: 	"9600",
	idx:		[ ],
	host:		'localhost',
        status:         'htc/connected',
	log: 		false
};

// Domoticz Switches - NAME : IDX
var switches = {
	inputs		: 145,
	modes		: 168,
	volume		: 170,
	displayText	: 0,	// 0 Disables
	modeText	: 167,
};

// Domoticz Input Selector - LEVEL : [INPUT, NAME]
var inputs = {
	0		: [ 0, 'Power Off' ],
	10		: [ 15, 'Nexus Player' ],
	20		: [ 04, 'PlayStation 3' ],
	30		: [ 22, 'PlayStation 4' ],
	40		: [ 24, 'Security Cameras' ],
};


// Domoticz Audio Mode Selector - LEVEL : [MODE, NAME]
var modes = {
	10		: [ '0006', 'Auto Surround' ],
	20		: [ '0151', 'Auto Level Control' ],
	30		: [ '0007', 'Stream Direct' ],
	40		: [ '0001', 'Stereo' ],
	50		: [ '0012', 'ProLogic' ],
	60		: [ '0014', 'ProLogic Music' ],
	70		: [ '0112', 'Extended Stereo'],
};

// Add Switches to MQTT Data Event
options.idx.push(switches['inputs'])
options.idx.push(switches['modes'])
options.idx.push(switches['volume'])

// Setup Hardware

var	receiver 	= new avr.Pioneer(options);
var	tv 		= new television.SharpTV(options);
var 	domoticz 	= new mqtt.domoticz(options);
//var 	vol		= new usbknob.PowerMote(options);

var	POWER		= false;
var	MUTE		= false;
var	INPUT		= false;
var	MODE		= false;

// START OF EVENTS

// OnConnect Events
receiver.on("connect", function() {
	console.log("Pioneer: connected");
	// Query Inital state slowly.
        setTimeout(function() {
                receiver.querypower()
                receiver.queryinput()
        }, 1500);
        setTimeout(function() {
                receiver.queryaudioMode()
                receiver.queryVolume()
        }, 3000);
});

domoticz.on('connect', function() {
	console.log("Domoticz MQTT: connected")
        domoticz.log('<HTC> Home Theatre Controller connected.')
});

// domoticz: data
domoticz.on('data', function(data) {
	// Input Selector Switch
	if (data.idx === switches['inputs']) {
		level = parseInt(data.svalue1)
		if ((inputs[level]) && (inputs[level][0] !== INPUT)) {
			if (TRACE) { console.log("DOMO: Input " + inputs[level][1]) }
			setInput(inputs[level][0])
		} else if ((!level) && (POWER)) {
			if (TRACE) { console.log("DOMO: Power Off") }
			receiver.power(0)
			tv.power(0)
			POWER = false
			INPUT = false
		}
	}
	// Audio Mode Selector Switch
	if (data.idx === switches['modes']) {
		level = parseInt(data.svalue1)
		if ((modes[level]) && (modes[level][0] !== MODE)) {
			if (TRACE) { console.log("DOMO: Audio Mode " + modes[level][1]) }
			receiver.listeningMode(modes[level][0])
			MODE = modes[level][0]
		}
	}
	if (TRACE) {
	        message = JSON.stringify(data)
	        console.log("DOMO: " + message.toString())
	}
});

// receiver: power
receiver.on('power', function(pwr) {
	if ((!pwr) && (POWER)) {
		domoticz.switch(switches['inputs'],0)
		domoticz.log("<HTC> Powering Down")
		tv.power(0)
	} else if ((pwr) && (!POWER)) {
		domoticz.log("<HTC> Powering On.")
		tv.power(1)
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
	if ((POWER) && (parseInt(input) !== parseInt(INPUT))) {
		var i = Object.keys(inputs);
		i.forEach(function(id){
			if (input === inputs[id][0]) {
				domoticz.switch(switches['inputs'],id)
				domoticz.log("<HTC> input changed to " + inputs[id][2])
			}
		});
		INPUT = parseInt(input)
	}
});

// receiver: listening modes
receiver.on('listenMode', function(mode,modeName) {
	if ((POWER) && (switches['modeText'])) {
		domoticz.device(switches['modeText'],0,modeName)
	}
});


// receiver: display
receiver.on('display', function(display) {
	if ((POWER) && (switches['displayText'])) {
		domoticz.device(switches['displayText'],0,display)
	}
});

// receiver: error
receiver.on('error', function(error) {
	console.log("FATAL AVR ERROR: " + error)
	domoticz.log("FATAL AVR ERROR: " + error)
	process.exit()
});

// setInput - Perform tasks every input change.
function setInput(input) {
	if ((input !== INPUT) && (INPUT)) {
		receiver.selectInput(input)
		if (!POWER) {
			tv.power(1)
			receiver.power(1)
		}
		if (MUTE) {
			receiver.mute(0)
		}
	} 
	INPUT = input
}
