#!/usr/bin/nodejs
// Pioneer AVR Hardware - Sends Commands and Notifies Domoticz of Updates
var 	util		= require('util'),
    	net    		= require('net'),
    	events 		= require('events'),
    	request 	= require('request'),
	MAXVOL		= 161,			// Max Volume 0db (Telnet: 3SUD to hard enforce)
	TRACE 		= true,
	DETAIL	 	= true;

var	idleTimer;

var Pioneer = function(options) {
	events.EventEmitter.call(this); // inherit from EventEmitter
	this.client = this.connect(options);
	this.inputNames = {};
	TRACE = options.log;
	MAXVOL = options.maxvol;
};

util.inherits(Pioneer, events.EventEmitter);

Pioneer.prototype.connect = function(options) {
	var self = this;
	if (isNaN(options.avrPort)) { var serialport 	= require("serialport") };
	if (isNaN(options.avrPort)) {
		var SerialPort = serialport.SerialPort; 	// localize object constructor 
		var client = new SerialPort(options.avrPort, { baudrate: 9600, rtscts: true,  parser: serialport.parsers.readline("\n") });
	} else {
	    	var client = net.connect({ host: options.avrHost, port: options.avrPort});
	}
	client.on("connect", function (socket) {
		clearTimeout(idleTimer)
		if (!isNaN(options.avrPort)) {			// for tcp connections send data every 2min to check connection.
			idleTimer = setTimeout(function() { self.client.write("\r") }, 120000 );
		}
        	handleConnection(self);
	});

	client.on("open", function (socket) {
        	handleConnection(self);
	});

    	client.on("data", function(data) {
       		handleData(self, data);
     	});	

    	client.on("close", function () {
		clearTimeout(idleTimer)				// Attempt reconnect every 30s
		idleTimer = setTimeout(function() { self.client = self.connect(options) }, 30000 );
       		handleEnd(self);
    	});

    	client.on("error", function(err) {
       		handleError(self, err);
    	});
	return client;
};

// Begin Query Functions

Pioneer.prototype.querypower = function() {	
    	var self = this;
    	self.client.write("?P\r");		// query power state
}

Pioneer.prototype.query2power = function() {	
    	var self = this;
    	self.client.write("?AP\r");		// query zone 2 power state
}

Pioneer.prototype.query3power = function() {	
    	var self = this;
    	self.client.write("?BP\r");		// query zone 3 power state
}

Pioneer.prototype.query4power = function() {	
    	var self = this;
    	self.client.write("?ZEP\r");		// query zone 4 power state
}

Pioneer.prototype.querymute = function() {	
    	var self = this;
    	self.client.write("?M\r");		// query mute state
}

Pioneer.prototype.query2mute = function() {	
    	var self = this;
    	self.client.write("?Z2M\r");		// query zone 2 mute state
}

Pioneer.prototype.query3mute = function() {	
    	var self = this;
    	self.client.write("?Z3M\r");		// query zone 3 mute state
}

Pioneer.prototype.queryinput = function() {
    	var self = this;
	self.client.write("?F\r");		// query input
}

Pioneer.prototype.query2input = function() {
    	var self = this;
	self.client.write("?ZS\r");		// query zone 2 input
}

Pioneer.prototype.query3input = function() {
    	var self = this;
	self.client.write("?ZT\r");		// query zone 3 input
}

Pioneer.prototype.query4input = function() {
    	var self = this;
	self.client.write("?ZEA\r");		// query zone 4 input
}

// Begin Command Functions

Pioneer.prototype.power = function(on) {
    	if (TRACE) {
        	console.log("AVR: turning power: " + on);
    	}
    	if (on) {				// Send this twice per manual.
        	this.client.write("PO\r");
        	this.client.write("PO\r");
    	}
    	else {
        this.client.write("PF\r");
    }
};

Pioneer.prototype.power2zone = function(on) {
    	if (TRACE) {
        	console.log("AVR: turning zone 2 power: " + on);
    	}
    	if (on) {				// Send this twice per manual.
        	this.client.write("APO\r");
    	}
    	else {
        this.client.write("APF\r");
    }
};

Pioneer.prototype.power3zone = function(on) {
    	if (TRACE) {
        	console.log("AVR: turning zone 3 power: " + on);
    	}
    	if (on) {				// Send this twice per manual.
        	this.client.write("BPO\r");
    	}
    	else {
        this.client.write("BPF\r");
    }
};

Pioneer.prototype.power4zone = function(on) {
    	if (TRACE) {
        	console.log("AVR: turning zone 4 power: " + on);
    	}
    	if (on) {				// Send this twice per manual.
        	this.client.write("ZEO\r");
    	}
    	else {
        this.client.write("ZEF\r");
    }
};

Pioneer.prototype.mute = function(on) {
    	if (TRACE) {
        	console.log("AVR: turning mute: " + on);
    	}
    	if (on) {
        	this.client.write("MO\r");
    	}
	else {
        	this.client.write("MF\r");
	}
};

Pioneer.prototype.mute2zone = function(on) {
    	if (TRACE) {
        	console.log("AVR: turning zone 2 mute: " + on);
    	}
    	if (on) {
        	this.client.write("Z2MO\r");
    	}
	else {
        	this.client.write("Z2MF\r");
	}
};

Pioneer.prototype.mute3zone = function(on) {
    	if (TRACE) {
        	console.log("AVR: turning mute: " + on);
    	}
    	if (on) {
        	this.client.write("Z3MO\r");
    	}
	else {
        	this.client.write("Z3MF\r");
	}
};

Pioneer.prototype.muteToggle = function() {
	if (TRACE) {
		console.log("AVR: toggling mute");
	}
	this.client.write("MZ\r");
};

Pioneer.prototype.mute2Toggle = function() {
	if (TRACE) {
		console.log("AVR: toggling mute");
	}
	this.client.write("Z2MZ\r");
};

Pioneer.prototype.mute3Toggle = function() {
	if (TRACE) {
		console.log("AVR: toggling mute");
	}
	this.client.write("Z3MZ\r");
};

Pioneer.prototype.volume = function(level) {
	if (TRACE) {
		console.log("setting volume: " + level + "%");
	}
	val = Math.round((level/100) * MAXVOL);
	
	var level = val.toString()
	this.client.write(pad(level,3) + "VL\r");
};

Pioneer.prototype.volume2zone = function(level) {
	if (TRACE) {
		console.log("setting zone 3 volume: " + level + "%");
	}
	val = Math.round((level/100) * 81);
	
	var level = val.toString()
	this.client.write(pad(level,3) + "ZV\r");
};

Pioneer.prototype.volume3zone = function(level) {
	if (TRACE) {
		console.log("setting zone 3 volume: " + level + "%");
	}
	val = Math.round((level/100) * 81);
	
	var level = val.toString()
	this.client.write(pad(level,3) + "YV\r");
};

Pioneer.prototype.volumeUp = function(times) {
        for (var i=0;i<times;i++) {
		this.client.write("VU\r");
	}
};

Pioneer.prototype.volumeDown = function(times) {
	times = Math.abs(times)
        for (var i=0;i<times;i++) {
		this.client.write("VD\r");
	}
};

Pioneer.prototype.selectInput = function(input) {
	this.client.write(pad(input,2) + "FN\r");
};

Pioneer.prototype.selectInput2zone = function(input) {
	this.client.write(pad(input,2) + "ZS\r");
};

Pioneer.prototype.selectInput3zone = function(input) {
	this.client.write(pad(input,2) + "ZT\r");
};

Pioneer.prototype.selectInput4zone = function(input) {
	this.client.write(pad(input,2) + "ZEA\r");
};

Pioneer.prototype.queryInputName = function(inputId) {
	this.client.write("?RGB" + inputId + "\r");
}

Pioneer.prototype.listeningMode = function(mode) {
	this.client.write(mode + "SR\r");
};

Pioneer.prototype.queryaudioMode = function(mode) {
	this.client.write("?L\r");
};

Pioneer.prototype.queryVolume = function(mode) {
	this.client.write("?V\r");
};

Pioneer.prototype.queryVolume2zone = function(mode) {
	this.client.write("?ZV\r");
};

Pioneer.prototype.queryVolume3zone = function(mode) {
	this.client.write("?YV\r");
};

Pioneer.prototype.queryTuner = function(mode) {
	this.client.write("?FR\r");
};

Pioneer.prototype.setTuner = function(frequency) {
	if (frequency.length !== 5) { 
		if (TRACE) { console.log("invalid frequency: " + frequency) }
		return false
	}
	array = frequency.split("")
	if (TRACE) {
		console.log("setting tuner to : " + array[0] + array[1] + array[2] + "." + array[3] + array[4] + "MHz");
	}
	this.client.write("TAC\r" + array[0] + "TP\r" + array[1] + "TP\r" + array[2] + "TP\r" + array[3] + "TP\r" + array[4] + "TP\r");
};


// On Connection refresh device status and setup timers to update on occasion.
function handleConnection(self) {
   	if (TRACE) {
        	console.log("AVR: got connection.");
    	}
    	self.client.write("\r");    // wake
    	//self.socket = socket;
	self.emit("connect");
}

// Monitor AVR and send updates to Domoticz
function handleData(self, d) {
    	var input;    
    	var data = d.toString(); // make sure it's a string
    	var length = data.lastIndexOf('\r');
    	data = data.substr(0, length);

    	// TODO implement a message to handler mapping instead of this big if-then statement

    	if (data.startsWith("PWR")) {        // power status
        	var pwr = (data == "PWR0");   // PWR0 = on, PWR1 = off
        	if (TRACE) {
            		console.log("AVR: " + pwr);
        	}
		pow = pwr;
        	self.emit("power", pwr);
    	}
    	if (data.startsWith("APR")) {        // power status
        	var pwr = (data == "APR0");   // PWR0 = on, PWR1 = off
        	if (TRACE) {
            		console.log("AVR: zone2 power" + pwr);
        	}
		pow = pwr;
        	self.emit("powerZone2", pwr);
    	}
    	if (data.startsWith("BPR")) {        // power status
        	var pwr = (data == "BPR0");   // PWR0 = on, PWR1 = off
        	if (TRACE) {
            		console.log("AVR: zone3 power" + pwr);
        	}
		pow = pwr;
        	self.emit("powerZone3", pwr);
    	}
    	if (data.startsWith("ZEP")) {        // power status
        	var pwr = (data == "ZEP0");   // PWR0 = on, PWR1 = off
        	if (TRACE) {
            		console.log("AVR: zone4 power" + pwr);
        	}
		pow = pwr;
        	self.emit("powerZone4", pwr);
    	}
    	else if (data.startsWith("VOL")) {   // volume status
        	var vol = data.substr(3, 3);
        
        	// translate to dB.
        	var val = Math.round((parseInt(vol) * 100) / MAXVOL);
        
        	if (TRACE) {
            		console.log("AVR: volume " + val + "%");
        	}
      		self.emit("volume", val);
    	}
    	else if (data.startsWith("ZV")) {   // zone 2 volume status
        	var vol = data.substr(2, 3);
        
        	// translate to dB.
        	var val = Math.round((parseInt(vol) * 100) / 81);
        
        	if (TRACE) {
            		console.log("AVR: zone 2 volume " + val + "%");
        	}
      		self.emit("volumeZone2", val);
    	}
    	else if (data.startsWith("YV")) {   // zone 2 volume status
        	var vol = data.substr(2, 3);
        
        	// translate to dB.
        	var val = Math.round((parseInt(vol) * 100) / 81);
        
        	if (TRACE) {
            		console.log("AVR: zone 3 volume " + val + "%");
        	}
      		self.emit("volumeZone3", val);
    	}
    	else if (data.startsWith("MUT")) {   // mute status
        	var mute = data.endsWith("0");  // MUT0 = muted, MUT1 = not muted
        	if (TRACE) {
            		console.log("AVR: mute: " + mute);
        	}
		self.emit("mute", mute);
    	}
    	else if (data.startsWith("Z2MUT")) {   // Zone 2 mute status
        	var mute = data.endsWith("0");  // MUT0 = muted, MUT1 = not muted
        	if (TRACE) {
            		console.log("AVR: zone 2 mute: " + mute);
        	}
		self.emit("muteZone2", mute);
    	}
    	else if (data.startsWith("Z3MUT")) {   // mute status
        	var mute = data.endsWith("0");  // MUT0 = muted, MUT1 = not muted
        	if (TRACE) {
            		console.log("AVR: zone 3 mute: " + mute);
        	}
		self.emit("muteZone3", mute);
    	}
    	else if (data.startsWith("FN")) {
        	input = data.substr(2, 2);
        	if (TRACE) {
            		console.log("AVR input: " + input + " : " + self.inputNames[input]);
        	}
        	self.emit("input", parseInt(input), self.inputNames[input]);
    	}
    	else if (data.startsWith("Z2F")) {
        	input = data.substr(3, 2);
        	if (TRACE) {
            		console.log("AVR zone 2 input: " + input + " : " + self.inputNames[input]);
        	}
        	self.emit("inputZone2", parseInt(input), self.inputNames[input]);
    	}
    	else if (data.startsWith("Z3F")) {
        	input = data.substr(3, 2);
        	if (TRACE) {
            		console.log("AVR zone 3 input: " + input + " : " + self.inputNames[input]);
        	}
        	self.emit("inputZone3", parseInt(input), self.inputNames[input]);
    	}
    	else if (data.startsWith("SSA")) {
         	if (TRACE && DETAIL) {
             		console.log("AVR SSA: " + data);
         	}
    	}
    	else if (data.startsWith("APR")) {
         	if (TRACE && DETAIL) {
             		console.log("AVR APR: " + data);
         	}
    	}
    	else if (data.startsWith("BPR")) {
         	if (TRACE && DETAIL) {
             		console.log("AVR BPR: " + data);
         	}
    	}
    	else if (data.startsWith("FR")) {					// Tuner Frequency
        	input = data.substr(2);
         	if (TRACE && DETAIL) {
             		console.log("AVR FR: " + data);
         	}
		self.emit("frequency", input)
    	}
    	else if (data.startsWith("LM")) {       				// listening mode
        	var mode = data.substring(2);
        	if (TRACE) {
            		console.log("AVR listening mode: " + listeningModes[mode]);
        	}
		self.emit("listenMode", mode, listeningModes[mode]);
    	}
    	else if (data.startsWith("FL")) {       				// display information
		var display = hex2a(data.substring(4)).trim();
		if (TRACE && DETAIL) {
			console.log("AVR FL: " + display);
		}
		self.emit("display", display);
    	}
    	else if (data.startsWith("RGB")) {      				// input name information. informs on input names
        	// handle input info
        	var inputId = data.substr(3, 2);
        	for (input in Inputs) {
            		if (Inputs[input] == inputId) {
                		// if (data.substr(5, 1) == "0") {
                    		// console.log("default input name")
                		// }
                		self.inputNames[inputId] = data.substr(6);
                		if (TRACE && DETAIL) {
                			console.log("AVR: set input " + input + " to " + self.inputNames[inputId]);
                		}
                		self.emit("inputName", inputId, self.inputNames[inputId]);
                		break;
            		}
        	} 
    	}
    	else if (data.startsWith("RGC")) {
        	if (TRACE && DETAIL) {
             		console.log("AVR RGC: " + data);
         	}
    	}
    	else if (data.startsWith("RGF")) {
         	if (TRACE && DETAIL) {
             		console.log("AVR RGF: " + data);
         	}
    	}
    	else if (data.length > 0) {
        	if (TRACE) {
            		console.log("AVR data: " + data);
        	}
    	}
}

function hex2a(hex) { 
	var str = ''; 
	for (var i = 0; i < hex.length; i += 2) 
		str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
	return str;
}

function pad(num, size) {
	var s = num+"";
	while (s.length < size) s = "0" + s;
	return s;
}

function handleEnd(self) {
	if (TRACE) {
		console.log("AVR: connection ended");
	}
        setTimeout(function() { receiver.connect(options) }, 30000 );
	self.emit("end");
}

function handleError(self, err) {
	if (TRACE) {
		console.log("AVR: connection error: " + err.message);
	}
	self.emit("error", err);
}

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function (str){
		return this.slice(0, str.length) == str;
	};
}

if (typeof String.prototype.endsWith != 'function') {
	String.prototype.endsWith = function (str){
		return this.slice(-str.length) == str;
	};
}

var pow = false;

exports.Pioneer = Pioneer;
exports.Inputs = Inputs;
exports.Power = pow;
exports.ListeningModes = listeningModes;

var Inputs = {
	dvd: "04",
	bd: "25",
	tv_sat: "05",
	dvr_bdr: "15",
	video_1: "10",
	video_2: "14",
	hdmi_1: "19",
	hdmi_2: "20",
	hdmi_3: "21",
	hdmi_4: "22",
	hdmi_5: "23",
	hdmi_6: "24",
	media: "26",
	ipod_usb: "17",
	xm_radio: "18",
	cd: "01",
	cdr_tape: "03",
	tuner: "02",
	phono: "00",
	multi_ch: "12",
	adapter_port: "33",
	sirius: "27",
	//hdmi_cyclic: "31",
};

var listeningModes = {
	"0101":"[)(] PLIIx MOVIE",
	"0102":"[)(] PLII MOVIE",
	"0103":"[)(] PLIIx MUSIC",
	"0104":"[)(] PLII MUSIC",
	"0105":"[)(] PLIIx GAME",
	"0106":"[)(] PLII GAME",
	"0107":"[)(] PROLOGIC",
	"0108":"Neo:6 CINEMA",
	"0109":"Neo:6 MUSIC",
	"010a":"XM HD Surround",
	"010b":"NEURAL SURROUND",
	"010c":"2 CH (Straight Decode)",
	"010d":"[)(] PLIIz HEIGHT",
	"010e":"WIDE SURROUND MOVIE",
	"010f":"WIDE SURROUND MUSIC",
	"0110":"STEREO",
	"0111":"Neo:X CINEMA",
	"0112":"Neo:X MUSIC",
	"0113":"Neo:X GAME",
	"0114":"NEURAL SURROUND+Neo:X CINEMA",
	"0115":"NEURAL SURROUND+Neo:X MUSIC",
	"0116":"NEURAL SURROUND+Neo:X GAMES",
	"1101":"[)(] PLIIx MOVIE",
	"1102":"[)(] PLIIx MUSIC",
	"1103":"[)(] DIGITAL EX",
	"1104":"DTS+Neo:6/DTS-HD+Neo:6",
	"1105":"ES MATRIX",
	"1106":"ES DISCRETE",
	"1107":"DTS-ES 8ch",
	"1108":"Multi CH (Straight Decode)",
	"1109":"[)(] PLIIz HEIGHT",
	"110a":"WIDE SURROUND MOVIE",
	"110b":"WIDE SURROUND MUSIC",
	"110c":"Neo:X CINEMA",
	"110d":"Neo:X MUSIC",
	"110e":"Neo:X GAME",
	"0201":"ACTION",
	"0202":"DRAMA",
	"0203":"SCI-FI",
	"0204":"MONOFILM",
	"0205":"ENTERTAINMENT SHOW",
	"0206":"EXPANDED",
	"0207":"TV SURROUND",
	"0208":"ADVANCED GAME",
	"0209":"SPORTS",
	"020a":"CLASSICAL",
	"020b":"ROCK/POP",
	"020c":"UNPLUGGED",
	"020d":"EXTENDED STEREO",
	"020e":"PHONES SURROUND",
	"020f":"FRONT STAGE SURROUND ADVANCE FOCUS",
	"0210":"FRONT STAGE SURROUND ADVANCE WIDE",
	"0211":"SOUND RETRIEVER AIR",
	"0301":"[)(] PLIIx MOVIE+THX",
	"0302":"[)(] PLII MOVIE+THX",
	"0303":"[)(] PL+THX CINEMA",
	"0304":"Neo:6 CINEMA+THX",
	"0305":"THX CINEMA",
	"0306":"[)(] PLIIx MUSIC+THX",
	"0307":"[)(] PLII MUSIC+THX",
	"0308":"[)(] PL+THX MUSIC",
	"0309":"Neo:6 MUSIC+THX",
	"030a":"THX MUSIC",
	"030b":"[)(] PLIIx GAME+THX",
	"030c":"[)(] PLII GAME+THX",
	"030d":"[)(] PL+THX GAMES",
	"030e":"THX ULTRA2 GAMES",
	"030f":"THX SELECT2 GAMES",
	"0310":"THX GAMES",
	"0311":"[)(] PLIIz+THX CINEMA",
	"0312":"[)(] PLIIz+THX MUSIC",
	"0313":"[)(] PLIIz+THX GAMES",
	"0314":"Neo:X CINEMA+THX CINEMA",
	"0315":"Neo:X MUSIC+THX MUSIC",
	"0316":"Neo:X GAMES+THX GAMES",
	"1301":"THX Surround EX",
	"1302":"Neo:6+THXC INEMA",
	"1303":"ES MTRX+THX CINEMA",
	"1304":"ES DISC+THX CINEMA",
	"1305":"ES 8ch+THX CINEMA",
	"1306":"[)(] PLIIx MOVIE+THX",
	"1307":"THX ULTRA2 CINEMA",
	"1308":"THX SELECT2 CINEMA",
	"1309":"THX CINEMA",
	"130a":"Neo:6+THX MUSIC",
	"130b":"ES MTRX+THX MUSIC",
	"130c":"ES DISC+THX MUSIC",
	"130d":"ES 8ch+THX MUSIC",
	"130e":"[)(] PLIIx MUSIC+THX",
	"130f":"THX ULTRA2 MUSIC",
	"1310":"THX SELECT2 MUSIC",
	"1311":"THX MUSIC",
	"1312":"Neo:6+THX GAMES",
	"1313":"ES MTRX+THX GAMES",
	"1314":"ES DISC+THX GAMES",
	"1315":"ES 8ch+THX GAMES",
	"1316":"[)(] EX+THX GAMES",
	"1317":"THX ULTRA2 GAMES",
	"1318":"THX SELECT2 GAMES",
	"1319":"THX GAMES",
	"131a":"[)(] PLIIz + THXCINEMA",
	"131b":"[)(] PLIIz + THXMUSIC",
	"131c":"[)(] PLIIz + THXGAMES",
	"131d":"Neo:X CINEMA+THX CINEMA",
	"131e":"Neo:X MUSIC+THX MUSIC",
	"131f":"Neo:X GAME+THX GAMES",
	"0401":"STEREO",
	"0402":"[)(] PLII MOVIE",
	"0403":"[)(] PLIIx MOVIE",
	"0404":"Neo:6 CINEMA",
	"0405":"AUTO SURROUND (Straight Decode)",
	"0406":"[)(] DIGITAL EX",
	"0407":"[)(] PLIIx MOVIE",
	"0408":"DTS+Neo:6",
	"0409":"ES MATRIX",
	"040a":"ES DISCRETE",
	"040b":"DTS-ES 8ch",
	"040c":"XM HD Surround",
	"040d":"NEURAL SURR",
	"040e":"RETRIEVER AIR",
	"040f":"Neo:X CINEMA",
	"0410":"Neo:X CINEMA",
	"0501":"STEREO",
	"0502":"[)(] PLII MOVIE",
	"0503":"[)(] PLIIx MOVIE",
	"0504":"Neo:6 CINEMA",
	"0505":"Auto Level (Straight Decode)",
	"0506":"[)(] DIGITAL EX",
	"0507":"[)(] PLIIx MOVIE",
	"0508":"DTS+Neo:6",
	"0509":"ES MATRIX",
	"050a":"ES DISCRETE",
	"050b":"DTS-ES 8ch",
	"050c":"XM HD Surround",
	"050d":"NEURAL SURROUND",
	"050e":"RETRIEVER AIR",
	"050f":"Neo:X CINEMA",
	"0510":"Neo:X CINEMA",
	"0601":"STEREO",
	"0602":"[)(] PLII MOVIE",
	"0603":"[)(] PLIIx MOVIE",
	"0604":"Neo:6 CINEMA",
	"0605":"STREAM DIRECT (Straight Decode)",
	"0606":"[)(] DIGITAL EX",
	"0607":"[)(] PLIIx MOVIE",
	"0608":"(nothing)",
	"0609":"ES MATRIX",
	"060a":"ES DISCRETE",
	"060b":"DTS-ES 8ch",
	"060c":"Neo:X CINEMA",
	"060d":"Neo:X CINEMA",
	"0701":"STREAM DIRECT PURE 2ch",
	"0702":"[)(] PLII MOVIE",
	"0703":"[)(] PLIIx MOVIE",
	"0704":"Neo:6 CINEMA",
	"0705":"STREAM DIRECT PURE (Straight Decode)",
	"0706":"[)(] DIGITAL EX",
	"0707":"[)(] PLIIx MOVIE",
	"0708":"(nothing)",
	"0709":"ES MATRIX",
	"070a":"ES DISCRETE",
	"070b":"DTS-ES 8ch",
	"070c":"Neo:X CINEMA",
	"070d":"Neo:X CINEMA",
	"0881":"OPTIMUM",
	"0e01":"HDMI PASSTHROUGH",
	"0f01":"MULTI CH IN"
};
