#!/usr/bin/nodejs
# PowerMate AVR - Controlls volume and power via PowerMate USB

var	PowerMate 	= require('node-powermate');

// PowerMate Volume Knob
var powermate = new PowerMate();
var dblClickTimer;
var pressTimer;
var isDown = false;

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

// Volume Knob Gesstures section
var commandReady = true;
var commandTimer;

// Turn up volume
function right(delta) {
	if (commandReady) {
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
		commandReady = false;
		reciever.volumeDown();
		commandTimer = setTimeout(function() {
			commandReady = true;
		}, 100);
	}
}
// Toggle mute
function singleClick() {
	receiver.muteToggle();
}
// Return to Nexus
function doubleClick() {
        receiver.power(true);
	receiver.selectInput(15);
}
// Power Off
function longClick() {
        receiver.power(false);
}
// TODO
function downRight() {
}

function downLeft() {
}

