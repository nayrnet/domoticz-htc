#!/usr/bin/nodejs
// Domoticz Home Theatre Controller (DOMOTICZ-HTC)
// NodeJS Framework for integrating Home Theatre Equipment with Domoticz.

// The default setup is my own and uses Pioneer AVR, SharpTV and PowerMate USB hardware
// Expanding it from here to suit your own hardware configuration should be straight forward.

var 	avr 		= require('./hardware/pioneeravr.js'),
	television	= require('./hardware/sharptv.js'),
	usbremote 	= require('node-powermate'),
	mqtt            = require('node-domoticz-mqtt'),
	TRACE		= false;

var options = {
	avrPort: 	50000,
	avrHost: 	"192.168.4.66",
	tvPort: 	"/dev/ttyUSB-TV",
	tvBaud: 	"9600",
	idx:		[ ],
	request:	false,
	host:		'localhost',
        status:         'htc/connected',
	log: 		false
};

// Domoticz Switches - NAME : IDX
var switches = {
	inputs		: 145,
	modes		: 168,
	volume		: 177,
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
var 	powermate 	= new usbremote();

var	POWER		= false;
var	MUTE		= false;
var	INPUT		= false;
var	MODE		= false;
var	VOLUME		= false;
var	WAIT		= false;
var	DOWN		= false;
var	READY		= true;

var	dblClickTimer;
var	pressTimer;
var	commandTimer;


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
		if ((level) && (inputs[level][0] !== INPUT)) {
			if (TRACE) { console.log("DOMO: Input " + inputs[level][1]) }
			setInput(inputs[level][0])
		} else if ((!level) && (POWER)) {
			if (TRACE) { console.log("DOMO: Power Off") }
			receiver.power(0)
			tv.power(0)
		}
	}
	// Audio Mode Selector Switch
	if (data.idx === switches['modes']) {
		level = parseInt(data.svalue1)
		if (parseInt((modes[level])) && (modes[level][0] !== MODE)) {
			if (TRACE) { console.log("DOMO: Audio Mode " + modes[level][1]) }
			receiver.listeningMode(modes[level][0])
			MODE = modes[level][0]
		}
	}
	// Volume Switch
	if (data.idx === switches['volume']) {
		val = parseInt(data.svalue1) + 1
		if ((val !== VOLUME) && (VOLUME) && (data.nvalue === 2)) {
			if (TRACE) { console.log("DOMO: Volume " + val) }
			MUTE=0
			WAIT=true
			receiver.volume(val)
			setTimeout(function() {
				WAIT=false
			}, 500);
		} else if ((data.nvalue === 0) && (!MUTE)) {
			if (TRACE) { console.log("DOMO: Mute ON") }
			MUTE=1
			receiver.mute(true)
		} else if ((data.nvalue === 1) && (MUTE)) {
			if (TRACE) { console.log("DOMO: Mute OFF") }
			MUTE=0
			receiver.mute(false)			
		}
		VOLUME = val
	}
	if (TRACE) {
	        message = JSON.stringify(data)
	        console.log("DOMO: " + message.toString())
	}
});

// receiver: power
receiver.on('power', function(pwr) {
	if (!pwr) {
		domoticz.switch(switches['inputs'],0)
		domoticz.switch(switches['volume'],0)
		domoticz.switch(switches['modes'],0)
		powermate.setBrightness(0)
		powermate.setPulseAsleep(true)
		domoticz.log("<HTC> Powering Down")
		tv.power(0)
	} else if (pwr) {
		domoticz.log("<HTC> Powering On.")
		domoticz.switch(switches['volume'],255)
		domoticz.switch(switches['modes'],10)
		tv.power(1)
		if (VOLUME) {
			powermate.setBrightness(VOLUME*2.55)
		} else {
			powermate.setBrightness(255)
		}
	}
	POWER = pwr
});

// receiver: volume
receiver.on('volume', function(val) {
	if ((switches['volume']) && (VOLUME !== val) && (!WAIT)) {
		VOLUME=val
		domoticz.switch(switches['volume'],parseInt(val))
		powermate.setBrightness(val*2.55)
	}
});

// receiver: mute
receiver.on('mute', function(mute) {
	if (switches['volume']) {
		if ((mute) && (!MUTE)) {
			domoticz.switch(switches['volume'],0)
			tv.mute(true)
			powermate.setPulseSpeed(511)
			powermate.setPulseAwake(true)
		} else if (MUTE) {
			domoticz.switch(switches['volume'],255)
			tv.mute(false)
			powermate.setPulseAwake(false)
			powermate.setBrightness(VOLUME*2.55)
		}
		MUTE = mute
	}
});

// receiver: input
receiver.on('input', function(input,inputName) {
	if ((parseInt(input) !== parseInt(INPUT))) {
		var i = Object.keys(inputs);
		i.forEach(function(id){
			if (input === inputs[id][0]) {
				domoticz.switch(switches['inputs'],id)
				domoticz.log("<HTC> input changed to " + inputs[id][1])
			}
		});
		INPUT = parseInt(input)
	}
});

// receiver: listening modes
receiver.on('listenMode', function(mode,modeName) {
	if (switches['modeText']) {
		domoticz.device(switches['modeText'],0,modeName)
	}
});

// receiver: display
receiver.on('display', function(display) {
	if (switches['displayText']) {
		domoticz.device(switches['displayText'],0,display)
	}
});

// powermate: buttonDown
powermate.on('buttonDown', function() {
	DOWN = true;
	// If we hold the button down for more than 2 seconds, let's call it a long press....
	pressTimer = setTimeout(longClick, 2000);
});

// powermate: buttonUp
powermate.on('buttonUp', function() {
	DOWN = false;
	// If the timer is still going call it a short click
	if (pressTimer._idleNext) {
		if (dblClickTimer && dblClickTimer._idleNext) {
			clearTimeout(dblClickTimer);
			doubleClick();
		} else {
			dblClickTimer=setTimeout(singleClick,500);
		}
	}
	clearTimeout(pressTimer);
});

// powermate: wheelturn
powermate.on('wheelTurn', function(delta) {
	clearTimeout(pressTimer);
	// This is a right turn
	if (delta > 0) {
		if (DOWN) downRight(); // down
		else right(delta); // up
	}
	// Left
	if (delta < 0) {
		if (DOWN) downLeft(); // down
		else left(delta); // up
    	}
});

// Begin Functions

// setInput - Perform tasks every input change.
function setInput(input) {
	if ((input !== INPUT) && (INPUT)) {
		if (!POWER) {
			tv.power(1)
			receiver.power(1)
			domoticz.switch(switches['volume'],255)
			domoticz.switch(switches['modes'],10)
		}
		if (MUTE) {
			receiver.mute(0)
		}
		receiver.selectInput(input)
		powermate.setPulseAwake(true)
		setTimeout(function() {
			powermate.setPulseAwake(false)
                        powermate.setBrightness(VOLUME*2.55)
		}, 5000);

	} 
	INPUT = input
}

// Gessture Functions

// Turn up volume
function right(delta) {
	if (READY) {
		if(TRACE) { console.log("VOLUME: " + delta) }
		READY = false
		receiver.volumeUp(delta)
		commandTimer = setTimeout(function() {
			READY = true;
		}, 100);
	}
}

// Turn down volume
function left(delta) {
	if (READY) {
		if(TRACE) { console.log("VOLUME: " + delta) }
		READY = false
		receiver.volumeDown(delta)
		commandTimer = setTimeout(function() {
			READY = true;
		}, 100);
	}
}

// Toggle mute
function singleClick() {
	if(TRACE) { console.log('Single Click') }
	receiver.muteToggle();
}

// Return to Nexus
function doubleClick() {
	if(TRACE) { console.log('Double Click') }
	setInput(15)
}

// Power Off
function longClick() {
	if(TRACE) { console.log('Long Click') }
        receiver.power(false);
	POWER=false
}

// Set Scenes
function downRight() {
	if(TRACE) { console.log('Down and Right') }
	if (READY) {
		READY = false
		domoticz.scene(16)
		commandTimer = setTimeout(function() {
			READY = true;
		}, 1000);
	}
}

function downLeft() {
	if(TRACE) { console.log('Down and Left') }
	if (READY) {
		READY = false
		domoticz.scene(5)
		commandTimer = setTimeout(function() {
			READY = true;
		}, 1000);
	}
}

// Default LED State
powermate.setPulseAsleep(true)
powermate.brightness(0)

// receiver: error
receiver.on('error', function(error) {
	console.log("FATAL AVR ERROR: " + error)
	domoticz.log("FATAL AVR ERROR: " + error)
	process.exit()
});

// domoticz: error
domoticz.on('error', function(error) {
	console.log("FATAL MQTT ERROR: " + error)
	process.exit()
});

// OnExit
process.on( "SIGINT", function() {
	powermate.close()
        setTimeout(function() {
		process.exit()
        }, 500);
});
