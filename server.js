#!/usr/bin/nodejs
// Domoticz Home Theatre Controller (DOMOTICZ-HTC)
// NodeJS Framework for integrating Home Theatre Equipment with Domoticz.

// Load Configuration
var	options		= require('./config').options;
var	switches	= require('./config').switches;
var	inputs		= require('./config').inputs;
var	modes		= require('./config').modes;
var	zoneInputs	= require('./config').zoneInputs;
var	radio		= require('./config').radio;

// Load Modules & Hardware
var 	avr 		= require('./hardware/pioneeravr.js');
var	mqtt            = require('node-domoticz-mqtt');
var	receiver 	= new avr.Pioneer(options);
var 	domoticz 	= new mqtt.domoticz(options);

if (options.sharptv) {
	var	television	= require('./hardware/sharptv.js');
	var	tv 		= new television.SharpTV(options);
} else { var	tv		= false; }

if (options.powermate) {
	var	usbremote 	= require('node-powermate');
	var 	powermate 	= new usbremote();
} else { var	powermate	= false; }

// Add Switches to MQTT Data Event Gathering
if (switches.inputs)	{ options.idx.push(switches.inputs) }
if (switches.modes)	{ options.idx.push(switches.modes) }
if (switches.volume)	{ options.idx.push(switches.volume) }
if (switches.z2volume)	{ options.idx.push(switches.z2volume) }
if (switches.z3volume)	{ options.idx.push(switches.z3volume) }
if (switches.lights)	{ options.idx.push(switches.lights) }
if (switches.zone2)	{ options.idx.push(switches.zone2) }
if (switches.zone3)	{ options.idx.push(switches.zone3) }
if (switches.zone4)	{ options.idx.push(switches.zone4) }
if (switches.tuner)	{ options.idx.push(switches.tuner) }

// Globals
var	TRACE		= true;;
var	POWER		= false;
var	MUTE		= false;
var	INPUT		= false;
var	MODE		= false;
var	VOLUME		= false;
var	WAIT		= false;
var	DOWN		= false;
var	READY		= true;
var	LIGHTS		= false;
var	LIGHTS2		= false;
var	FREQUENCY	= false;

var	switchTimer;
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

	// Check power status every 15mins, make sure connection is still alive and we are in sync.
	setInterval(function(){
                receiver.querypower()
                receiver.queryinput()
	}, 900000);  
});

domoticz.on('connect', function() {
	console.log("Domoticz MQTT: connected")
        domoticz.log('<HTC> Home Theatre Controller connected.')
	domoticz.request(switches.lights)
});

// domoticz: data
domoticz.on('data', function(data) {
	// Input Selector Switch
	if (data.idx === switches.inputs) {
		level = parseInt(data.svalue1)
		if ((level) && (inputs[level][0] !== INPUT)) {
			if (TRACE) { console.log("DOMO: Input " + inputs[level][1]) }
			setInput(inputs[level][0])
		} else if ((!level) && (POWER)) {
			if (TRACE) { console.log("DOMO: Power Off") }
			receiver.power(0)
			if (tv) { tv.power(0) }
		} else if ((!POWER) && (level)) {
			receiver.power(1)
			if (tv) { tv.power(1) }
		}
	}
	// Audio Mode Selector Switch
	if (data.idx === switches.modes) {
		level = parseInt(data.svalue1)
		if ((modes[level]) && (modes[level][0] !== MODE)) {
			if (TRACE) { console.log("DOMO: Audio Mode " + modes[level][1]) }
			receiver.listeningMode(modes[level][0])
			MODE = modes[level][0]
		}
	}
	// Volume Switch
	if (data.idx === switches.volume) {
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
	// Lights Dimmer
	if (data.idx === switches.lights){
		LIGHTS2 = parseInt(data.svalue1)
		clearTimeout(switchTimer)
	        switchTimer = setTimeout(function() {
			if (LIGHTS2 === parseInt(data.svalue1)) {
				LIGHTS = parseInt(data.svalue1)
				if (TRACE) { console.log("LIGHTS: " + LIGHTS) }
			}
	        }, 15000);
	}
	// FM Tuner Selector Switch
	if (data.idx === switches.tuner) {
		level = parseInt(data.svalue1)
		if (radio[level]) {
			if (TRACE) { console.log("DOMO: Tuner " + radio[level][1]) }
			receiver.setTuner(radio[level][0])
		}
	}
	if (TRACE) {
	        message = JSON.stringify(data)
	        console.log("DOMO: " + message.toString())
	}
});

// receiver: power
receiver.on('power', function(pwr) {
	if (TRACE) { console.log("POWER: " + pwr) }
	if (!pwr) {
		POWER = false
		domoticz.log("<HTC> Powering Down")
		if (switches.inputs)	{ domoticz.switch(switches.inputs,0) }
		if (switches.modes) 	{ domoticz.switch(switches.modes,0) }
		if (switches.volume) 	{ domoticz.switch(switches.volume,0) }
		if (switches.zone2)	{ domoticz.switch(switches.zone2,0) }
		if (switches.z2volume) 	{ domoticz.switch(switches.volume,0) }
		if (switches.zone3) 	{ domoticz.switch(switches.zone3,0) }
		if (switches.z3volume) 	{ domoticz.switch(switches.volume,0) }
		if (switches.zone4) 	{ domoticz.switch(switches.zone4,0) }
		if (switches.tuner) 	{ domoticz.switch(switches.tuner,0) }
		if (powermate) 		{ powermate.setBrightness(0) }
		if (powermate) 		{ powermate.setPulseAsleep(true) }
		if (tv) { tv.power(0) }
	} else {
		domoticz.log("<HTC> Powering On.")
		POWER = true
		//receiver.queryinput()
		if (switches.volume) 	{ domoticz.switch(switches.volume,255) }
		if (powermate) 		{ powermate.setBrightness(VOLUME*2.55) }
		if (tv) 		{ tv.power(1) }
	}
});

// receiver: volume
receiver.on('volume', function(val) {
	if (TRACE) { console.log("VOLUME: " + val) }
	if ((switches.volume) && (VOLUME !== val) && (!WAIT)) {
		domoticz.switch(switches.volume,parseInt(val))
	}
	if (tv) 	{ tv.volume(val) }
	if (powermate) 	{ powermate.setBrightness(val*2.55) }
	VOLUME=val
});

// receiver: mute
receiver.on('mute', function(mute) {
	if (TRACE) { console.log("MUTE: " + mute) }
	if ((mute) && (!MUTE)) {
		if (switches.volume) 	{ domoticz.switch(switches.volume,0) }
		if (powermate) 		{ powermate.setPulseAwake(true) }
		if (tv) 		{ tv.mute(1) }
	} else if (MUTE) {
		if (switches.volume) 	{ domoticz.switch(switches.volume,255) }
		if (powermate) 		{ powermate.setPulseAwake(false) }
		if (powermate) 		{ powermate.setBrightness(VOLUME*2.55) }
		if (tv) 		{ tv.mute(0) }
	}
	MUTE = mute
});

// receiver: input
receiver.on('input', function(input,inputName) {
	if (TRACE) { console.log("INPUT: " + input) }
	if (POWER) {
		var i = Object.keys(inputs);
		i.forEach(function(id){
			if (input === inputs[id][0]) {
				domoticz.switch(switches.inputs,id)
				domoticz.log("<HTC> input changed to " + inputs[id][1])
			}
		});
	}
	INPUT = parseInt(input)
});

// receiver: listening modes
receiver.on('listenMode', function(mode,modeName) {
	if (switches.modeText)		{ domoticz.device(switches.modeText,0,modeName) }
});

// receiver: display
receiver.on('display', function(display) {
	if (switches.displayText) 	{ domoticz.device(switches.displayText,0,display) }
});

// Begin PowerMate Calls
if (powermate) {
	// powermate: buttonDown
	powermate.on('buttonDown', function() {
		DOWN = true;
		// If we hold the button down for more than 1 seconds, let's call it a long press....
		pressTimer = setTimeout(longClick, 1000);
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
			if (DOWN) downRight(delta); // down
			else right(delta); // up
		}
		// Left
		if (delta < 0) {
			if (DOWN) downLeft(delta); // down
			else left(delta); // up
	    	}
	});
}

// Begin Functions

// setInput - Perform tasks every input change.
function setInput(input) {
	if (!POWER) {
		receiver.power(1)
		if (tv) 		{ tv.power(1) }
		if (switches.volume)	{ domoticz.switch(switches.volume,255) }
		if (switches.modes)	{ domoticz.switch(switches.modes,10) }
		if (powermate) { 
			powermate.setPulseAwake(true)
			setTimeout(function() {
				powermate.setPulseAwake(false)
                	        powermate.setBrightness(VOLUME*2.55)
			}, 10000);
		}
	}
	if (input !== INPUT) {
		if (MUTE) 	{ receiver.mute(0) }
		receiver.selectInput(input)
		receiver.volume(45)
		if (powermate) { 
			powermate.setPulseAwake(true)
			setTimeout(function() {
				powermate.setPulseAwake(false)
                	        powermate.setBrightness(VOLUME*2.55)
			}, 5000);
		}
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
		commandTimer = setTimeout(function() { READY = true; }, 100);
	}
}

// Turn down volume
function left(delta) {
	if (READY) {
		if(TRACE) { console.log("VOLUME: " + delta) }
		READY = false
		receiver.volumeDown(delta)
		commandTimer = setTimeout(function() { READY = true; }, 100);
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

// Dimmer/Tuner Function
function downRight(delta) {
	if (READY) {
		READY = false
		if ((options.ptz) && (INPUT === 24) && (POWER)) {		// Hijack Dimmer for PTZ on Camera Input
		// TODO
		}
		if ((switches.tuner) && (INPUT === 02) && (POWER)) {		// Hijack Dimmer for FM Tuner Selector
		// TODO
		}
		if (switches.lights) {
			level = (LIGHTS + (Math.abs(delta)*2))
			if(level< 10) level = 18
			domoticz.switch(switches.lights,level)
			LIGHTS = level
			commandTimer = setTimeout(function() { READY = true; }, 100);
			if(TRACE) { console.log('Lights Up ' + level) }
		}
	}
}

function downLeft(delta) {
	if (READY) {
		READY = false
		if ((options.ptz) && (INPUT === 24) && (POWER)) {		// Hijack Dimmer for PTZ on Camera Input
		// TODO
		}
		if ((switches.tuner) && (INPUT === 02) && (POWER)) {		// Hijack Dimmer for FM Tuner Selector
		// TODO
		}
		if (switches.lights) {
			level = (LIGHTS - (Math.abs(delta)*2))
			if(level<10) level = 0
			domoticz.switch(switches.lights,level)
			LIGHTS = level
			commandTimer = setTimeout(function() { READY = true; }, 100);
			if(TRACE) { console.log('Lights Down ' + level) }
		}
	}
}

// Default LED State
if (powermate) { 
	powermate.setPulseSpeed(511)
	powermate.setPulseAsleep(true)
	powermate.brightness(0)
}

// receiver: error
receiver.on('error', function(error) {
	console.log("FATAL AVR ERROR: " + error)
	domoticz.log("FATAL AVR ERROR: " + error)
	process.exit()
});

// domoticz: error
domoticz.on('error', function(error) {
	console.log("MQTT ERROR: " + error)
});

// OnExit
process.on( "SIGINT", function() {
	if (powermate) { powermate.close() }
        setTimeout(function() {
		process.exit()
        }, 500);
});
