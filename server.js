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

if (options.syslog) {
	var 	SysLogger 	= require('ain2');
	var	console		= new SysLogger({tag: 'htc', facility: 'daemon'});
} else {
	var	Console		= require('console').Console;
	var	console		= new Console(process.stdout, process.stderr);
}
if (options.sharptv) {
	var	television	= require('./hardware/sharptv.js');
	var	tv 		= new television.SharpTV(options);
} else { var	tv		= false; }

if (options.powermate) {
	var	usbremote 	= require('node-powermate');
	var 	powermate 	= new usbremote();
} else { var	powermate	= false; }

// Add Switches to MQTT Data Event Gathering
if (switches.inputs)	options.idx.push(switches.inputs);
if (switches.modes)	options.idx.push(switches.modes);
if (switches.volume)	options.idx.push(switches.volume);
if (switches.z2volume)	options.idx.push(switches.z2volume);
if (switches.z3volume)	options.idx.push(switches.z3volume);
if (switches.lights)	options.idx.push(switches.lights);
if (switches.zone2)	options.idx.push(switches.zone2);
if (switches.zone3)	options.idx.push(switches.zone3);
if (switches.zone4)	options.idx.push(switches.zone4);
if (switches.tuner)	options.idx.push(switches.tuner);

// Globals
var	TRACE		= true;;
var	POWER		= false;
var	Z2POWER		= false;
var	MUTE		= false;
var	INPUT		= false;
var	Z2INPUT		= false;
var	MODE		= false;
var	VOLUME		= false;
var	WAIT		= false;
var	DOWN		= false;
var	READY		= true;
var	LIGHTS		= false;
var	LIGHTS2		= false;
var	FREQUENCY	= false;
var	FM		= false;

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

	// Query status every 5 mins, make sure connection is still alive and we are in sync.
	setInterval(function(){
                receiver.querypower()
                receiver.queryinput()
	}, 300000);  
});

domoticz.on('connect', function() {
	console.log("Domoticz MQTT: connected")
        domoticz.log('[HTC] Home Theatre Controller connected.')
	if (switches.lights)	domoticz.request(switches.lights);
});

// domoticz: data
domoticz.on('data', function(data) {
	// Input Selector Switch
	if (data.idx === switches.inputs) {
		level = parseInt(data.svalue1)
		if ((level) && (inputs[level][0] !== INPUT)) {
			if (TRACE) { console.log("DOMO: Input " + inputs[level][1]) }
			INPUT=inputs[level][0]
			setInput(inputs[level][0])
		} else if ((!level) && (POWER)) {
			if (TRACE) { console.log("DOMO: Power Off") }
			receiver.power(0)
			if (tv) { tv.power(0) }
		} 
	}
	// Audio Mode Selector Switch
	if (data.idx === switches.modes) {
		level = parseInt(data.svalue1)
		if ((modes[level]) && (modes[level][0] !== MODE) && (POWER)) {
			if (TRACE) { console.log("DOMO: Audio Mode " + modes[level][1]) }
			receiver.listeningMode(modes[level][0])
			MODE = modes[level][0]
		}
	}
	// Volume Switch
	if (data.idx === switches.volume) {
		if ((data.dtype !== "Light/Switch") || (data.stype !== "Switch") || (data.switchType !== "Dimmer")) {
			domoticz.log("[HTC] ERROR: Wrong Switch Type - " + data.name)
			console.log("DOMO ERROR: Wrong Switch Type - " + data.name)
			return 0
		}
		val = parseInt(data.svalue1) + 1
		if ((val !== VOLUME) && (VOLUME) && (data.nvalue === 2) && (READY)) {
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
		if ((radio[level]) && (FREQUENCY !== radio[level][0])) {
			FREQUENCY=radio[level][0]
			if (TRACE) { console.log("DOMO: Tuner " + FREQUENCY + " - " + radio[level][1]) }
			receiver.setTuner(FREQUENCY)
		}
	}
	// Zone 2 Input Selector Switch
	if (data.idx === switches.zone2) {
		level = parseInt(data.svalue1)
		if ((level) && (zoneInputs[level]) && (zoneInputs[level][0] !== Z2INPUT)) {
			if (TRACE) { console.log("DOMO: Zone 2 " + zoneInputs[level][0]) }
			if (!Z2POWER) receiver.power2zone(true);
			receiver.selectInput2zone(zoneInputs[level][0])
		} else if ((!level) && (Z2POWER)) {
			receiver.power2zone(false)
			//domoticz.switch(switches.zone2,0)
			//if (switches.z2volume)	domoticz.switch(switches.z2volume,0);
		}
	}
	if (TRACE) {
	        message = JSON.stringify(data)
	        console.log("DOMO: " + message.toString())
	}
});

// receiver: power
receiver.on('power', function(pwr) {
	if (TRACE) 			console.log("POWER: " + pwr);
	if (!pwr) {
		POWER = false
		INPUT = false
		FREQUENCY = false
		domoticz.log("[HTC] Pioneer AVR is off")
		if (switches.inputs)	domoticz.switch(switches.inputs,0);
		if (switches.modes)	domoticz.switch(switches.modes,0);
		if (switches.volume) 	domoticz.switch(switches.volume,0);
		if (switches.zone2)	domoticz.switch(switches.zone2,0);
		if (switches.z2volume) 	domoticz.switch(switches.z2volume,0);
		if (switches.zone3) 	domoticz.switch(switches.zone3,0);
		if (switches.z3volume) 	domoticz.switch(switches.z3volume,0);
		if (switches.zone4) 	domoticz.switch(switches.zone4,0);
		if (switches.tuner) 	domoticz.switch(switches.tuner,0);
		if (powermate) 		powermate.setBrightness(0);
		if (powermate) 		powermate.setPulseAsleep(true);
		if (tv)			tv.power(0);
	} else {
		domoticz.log("[HTC] Pioneer AVR is ON")
		POWER = true
		//receiver.queryinput()
		if (switches.modes)	domoticz.switch(switches.modes,10);
		if (switches.volume) 	receiver.queryVolume();
		if (switches.tuner)	receiver.queryTuner();
		if (switches.zone2)	receiver.query2power();
		if (switches.zone3)	receiver.query3power();;
		if (switches.zone4)	receiver.query4power();;
		if (powermate) 		powermate.setBrightness(VOLUME*2.55);
	}
});

// receiver: power zone 2
receiver.on('powerZone2', function(pwr) {
	Z2POWER = pwr
	if (TRACE) 			console.log("POWER Z2: " + pwr);
	if (!pwr) {
		Z2INPUT = false
		domoticz.log("[HTC] Zone 2: OFF")
		if (switches.zone2)	domoticz.switch(switches.zone2,0);
		if (switches.z2volume) 	domoticz.switch(switches.z2volume,0);
	} else {
		domoticz.log("[HTC] Zone 2: ON")
		if (switches.zone2)	receiver.query2input();
		if (switches.z2volume) 	receiver.queryVolume2zone();
	}
});


// receiver: volume
receiver.on('volume', function(val) {
	if (TRACE) 			console.log("VOLUME: " + val);
	if (tv) 			tv.volume(val);
	//if (powermate) 			powermate.setBrightness(val*2.55);
	if ((switches.volume) && (VOLUME !== val) && (!WAIT)) {
		WAIT = true
		domoticz.switch(switches.volume,parseInt(val))
	}
	clearTimeout(switchTimer)
	switchTimer = setTimeout(function() { 
		WAIT = false
	}, 1500);
	VOLUME=val
	READY=true
});

// receiver: mute
receiver.on('mute', function(mute) {
	if (TRACE) 			console.log("MUTE: " + mute);
	if ((mute) && (!MUTE)) {
		domoticz.log("[HTC] MUTE: ON")
		if (switches.volume) 	domoticz.switch(switches.volume,0);
		if (powermate) 		powermate.setPulseAwake(true);
		if (tv) 		tv.mute(1);
	} else if ((!mute) && (MUTE)) {
		domoticz.log("[HTC] MUTE: OFF")
		if (switches.volume) 	domoticz.switch(switches.volume,255);
		if (powermate) 		powermate.setPulseAwake(false);
		if (powermate) 		powermate.setBrightness(VOLUME*2.55);
		if (tv) 		tv.mute(0);
	}
});

// receiver: input
receiver.on('input', function(input,inputName) {
	if (TRACE) 			console.log("INPUT: " + input);
	if (POWER) {
		INPUT = parseInt(input)
		if ((switches.tuner) && (INPUT === 2) && (!FREQUENCY))		receiver.queryTuner();;
		var i = Object.keys(inputs);
		i.forEach(function(id){
			if (input === inputs[id][0]) {
				domoticz.switch(switches.inputs,id)
				domoticz.log("[HTC] Input changed to " + inputs[id][1])
			}
		});
	}
});

// receiver: input zone 2
receiver.on('inputZone2', function(input,inputName) {
	if (TRACE) 			console.log("INPUT Z2: " + input);
	if (POWER) {
		Z2INPUT = parseInt(input)
		if ((switches.tuner) && (Z2INPUT === 2) && (!FREQUENCY))	receiver.queryTuner();;
		var i = Object.keys(zoneInputs);
		i.forEach(function(id){
			if (input === zoneInputs[id][0]) {
				domoticz.switch(switches.zone2,id)
				domoticz.log("[HTC] Zone2 input changed to " + zoneInputs[id][1])
			}
		});
	}
});

// receiver: tuner frequency
receiver.on('frequency', function(fm) {
	if (TRACE) 			console.log("FREQUENCY: " + fm);
	if ((POWER) && (switches.tuner)) {
		FREQUENCY = fm.substr(1)
		var i = Object.keys(radio);
		i.forEach(function(id){
			if (fm.substr(1) === radio[id][0]) {
				domoticz.switch(switches.tuner,id)
				domoticz.log("[HTC] Radio tuned to " + radio[id][1])
				FM = parseInt(id)
			}
		});
	}
});

// receiver: listening modes
receiver.on('listenMode', function(mode,modeName) {
	if (switches.modeText)		domoticz.device(switches.modeText,0,modeName);
});

// receiver: display
receiver.on('display', function(display) {
	if (switches.displayText) 	domoticz.device(switches.displayText,0,display);
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
			else turn(delta); // up
		}
		// Left
		if (delta < 0) {
			if (DOWN) downLeft(delta); // down
			else turn(delta); // up
	    	}
	});
}

// Begin Functions

// setInput - Perform tasks every input change.
function setInput(input) {
	if (!POWER) {
		receiver.power(1)
		if ((tv) && (input !== 2))	tv.power(1);
		receiver.volume(45)
		setTimeout(function() { receiver.selectInput(input) }, 2500);
		if (powermate) { 
			powermate.setPulseAwake(true)
			setTimeout(function() {
				powermate.setPulseAwake(false)
                	        powermate.setBrightness(64)
			}, 10000);
		}
	} else {
		if ((input === 2) && (tv)) {
			tv.power(0)
		} else if (tv) {
			tv.power(1)
		}
		if (MUTE) 			receiver.mute(0);
		if (options.defaultVolume)	receiver.volume(options.defaultVolume);
		receiver.selectInput(input)
		if (powermate) { 
			powermate.setPulseAwake(true)
			setTimeout(function() {
				powermate.setPulseAwake(false)
                	        powermate.setBrightness(64)
			}, 5000);
		}
	} 
	INPUT = input
	//receiver.queryinput()
}

// Gessture Functions

// Turn up volume
function turn(delta) {
	if (READY) {
		//if (TRACE) 		console.log("PM Turn: " + delta);
		READY = false
		WAIT = true
		receiver.volume(VOLUME+delta);
	}
}

// Toggle mute
function singleClick() {
	if (TRACE)			console.log('PM: Single Click');
	receiver.muteToggle();
}

// Return to Nexus
function doubleClick() {
	if (TRACE)			console.log('PM: Double Click');
	INPUT=false
	setInput(15)
}

// Power Off
function longClick() {
	if (TRACE) 			console.log('PM: Long Click');
        receiver.power(false);
	POWER=false
}

// Dimmer/Tuner Function
function downRight(delta) {
	if (READY) {
		READY = false
		if ((options.ptz) && (INPUT === 24) && (POWER)) {		// Hijack Dimmer for PTZ on Camera Input
			console.log("PTZ Debug")
			commandTimer = setTimeout(function() { READY = true }, 1000);
		} else if ((switches.tuner) && (INPUT === 2) && (POWER)) {	// Hijack Dimmer for FM Tuner Selector
			var up = FM + 10;
			if (up > 100)	up = 10;
			domoticz.switch(switches.tuner,up)
			setTimeout(function() { READY = true }, 1000);
		} else {
			level = (LIGHTS + (Math.abs(delta)*2))
			if (level < 10)		level = 18;
			if (switches.lights)	domoticz.switch(switches.lights,level);
			if (TRACE)		console.log('Lights Up ' + level)
			commandTimer = setTimeout(function() { READY = true }, 100);
			LIGHTS = level
		}
	}
}

function downLeft(delta) {
	if (READY) {
		READY = false
		if ((options.ptz) && (INPUT === 24) && (POWER)) {		// Hijack Dimmer for PTZ on Camera Input
			console.log("PTZ Debug")
			commandTimer = setTimeout(function() { READY = true; }, 2000);
		} else if ((switches.tuner) && (INPUT === 2) && (POWER)) {	// Hijack Dimmer for FM Tuner Selector
			var down = FM - 10;
			if (down < 10)	down = 100;
			domoticz.switch(switches.tuner,down)
			setTimeout(function() { READY = true; }, 1000);
		} else {
			level = (LIGHTS - (Math.abs(delta)*2))
			if(level<10) level = 0
			domoticz.switch(switches.lights,level)
			LIGHTS = level
			commandTimer = setTimeout(function() { READY = true }, 100);
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
	if ((error.code === 'ECONNREFUSED') || (error.code === 'ETIMEDOUT') || (error.code === 'ECONNRESET')) {
		console.log('AVR ERROR: ' + error.code + ' @ ' + options.avrHost + ':' + options.avrPort);
		domoticz.log('[HTC] AVR CONNECTION ERROR: ' + error.code);
		receiver.setTimeout(30000, function() { receiver.connect(options) } );
	} else if (error.code === 'EPIPE') {
		console.log('AVR ERROR: CONNECTION NOT AVILABLE')
	} else {
		domoticz.log("[HTC] FATAL AVR ERROR: " + error.code)
		console.log("FATAL AVR ERROR: " + error)
		if (powermate) { powermate.close() }
        	setTimeout(function() { process.exit() }, 500);
	}
});

// receiver: end
receiver.on('end', function() {
	domoticz.log("[HTC] AVR CONNECTION CLOSED. reconnecting in 10s")
	console.log("AVR CONNECTION CLOSED! reconnecting in 10s")
	receiver.setTimeout(10000, function() { receiver.connect(options) } );
});

// domoticz: error
domoticz.on('error', function(error) {
	console.log("MQTT ERROR: " + error)
});

// powermate: error
if (powermate) {
	powermate.on('error', function(error) {
		console.log("PM ERROR: " + error)
	});
}

// htc: uncaught error
process.on('uncaughtException', function(err) {
	// handle the error safely
	console.log("UNKNOWN ERROR: " + err)
});

// htc: OnExit
process.on( "SIGINT", function() {
	console.log("Exiting...")
	domoticz.log("[HTC] Process Ended")
	if (powermate) { powermate.close() }
        setTimeout(function() {
		process.exit()
        }, 500);
});
