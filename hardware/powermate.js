#!/usr/bin/nodejs
// PowerMate USB - This is the physical device that controlls the AVR.

var	PowerMate 	= require('node-powermate'),
	receiver	= require('../server.js'),
	events		= require('events'),
	util   		= require('util').inherits;

var reciever = false;

var 	powermate 	= new PowerMate(),
	isDown 		= false,
	commandReady 	= true,
	TRACE		= true,
	dblClickTimer,
	pressTimer,
	commandTimer;

var PowerMate = function(options) {
	events.EventEmitter.call(this); // inherit from EventEmitter
    	TRACE = options.log;
}

// Gessture Functions

// Turn up volume
function right(delta) {
	if (commandReady) {
		if(TRACE) { console.log(delta) }
		commandReady = false;
		reciever.volumeUp();
		commandTimer = setTimeout(function() {
			commandReady = true;
		}, 100);
	}
}
// Turn down volume
function left(delta) {
	if (commandReady) {
		if(TRACE) { console.log(delta) }
		commandReady = false;
		reciever.volumeDown();
		commandTimer = setTimeout(function() {
			commandReady = true;
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
        receiver.power(true);
	receiver.selectInput(15);
}
// Power Off
function longClick() {
	if(TRACE) { console.log('Long Click') }
        receiver.power(false);
}
// TODO
function downRight() {
	if(TRACE) { console.log('Down and Right') }
}

function downLeft() {
	if(TRACE) { console.log('Down and Left') }
}

// TODO: LED Functions



// Activity Functions

powermate.on('buttonDown', function() {
	isDown = true;
	// If we hold the button down for more than 2 seconds, let's call it a long press....
	pressTimer = setTimeout(longClick, 2000);
});

powermate.on('buttonUp', function() {
	isDown = false;
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

powermate.on('wheelTurn', function(delta) {
	clearTimeout(pressTimer);
	// This is a right turn
	if (delta > 0) {
		if (isDown) downRight(); // down
		else right(delta); // up
	}
	// Left
	if (delta < 0) {
		if (isDown) downLeft(); // down
		else left(delta); // up
    	}
});

exports.PowerMate = PowerMate;
