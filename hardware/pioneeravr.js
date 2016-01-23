// Pioneer AVR Hardware - Sends Commands and Notifies Domoticz of Updates

var 	util		= require('util'),
    	net    		= require('net'),
    	events 		= require('events'),
    	request 	= require('request'),
	mqtt    	= require('mqtt'),
	domoticz	= mqtt.connect('mqtt://127.0.0.1'),
	TRACE 		= true,
	DETAIL	 	= true,
	domoURI 	= "http://dev:dev@localhost:8080";

var Pioneer = function(options) {
	events.EventEmitter.call(this); // inherit from EventEmitter
	this.client = this.connect(options);
	this.inputNames = {};
	TRACE = options.log;
	domoURI = options.domo;
};

util.inherits(Pioneer, events.EventEmitter);

Pioneer.prototype.connect = function(options) {
    var self = this;
    var client = net.connect(options);

    client.on("connect", function (socket) {
        handleConnection(self, socket);
    });
    
    client.on("data", function(data) {
        handleData(self, data);
     });

    client.on("end", function () {
        handleEnd(self);
    });

    client.on("error", function(err) {
        handleError(self, err);
    });

    return client;
};

Pioneer.prototype.querypower = function() {	
    var self = this;
    self.client.write("?P\r");		// query power state
}
Pioneer.prototype.querymute = function() {	
    var self = this;
    self.client.write("?M\r");		// query mute state
}
Pioneer.prototype.queryinput = function() {	
    var self = this;
    self.client.write("?F\r");		// query input
}






/**
 * Turn unit power on or off
 */
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

/**
 * Turn mute on or off
 */
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


Pioneer.prototype.muteToggle = function() {
    if (TRACE) {
        console.log("AVR: toggling mute");
    }
        this.client.write("MZ\r");
};



/**
 * 
 * @param {Object} db from -80 to +12
 */
Pioneer.prototype.volume = function(db) {
    // [0 .. 185] 1 = -80dB , 161 = 0dB, 185 = +12dB
    if (TRACE) {
        console.log("setting volume db: " + db);
    }
    var val = 0;
    if (typeof db === "undefined" || db === null) {
        val = 0;
    }
    else if (db < -80) {
        val = 0;
    }
    else if (db > 12) {
        val = 185;
    }
    else {
        val = Math.round((db * 2) + 161);
    }
    var level = val.toString();
    while (level.length < 3) {
        level = "0" + level;
    }
    if (TRACE) {
        console.log("setting volume level: " + level);
    }
    this.client.write(level + "VL\r");
};

Pioneer.prototype.volumeUp = function() {
    this.client.write("VU\r");
};

Pioneer.prototype.volumeDown = function() {
    this.client.write("VD\r");
};

/**
 * Set the input
 */
Pioneer.prototype.selectInput = function(input) {
    this.client.write(input + "FN\r");
};

/**
 * Query the input name
 */
Pioneer.prototype.queryInputName = function(inputId) {
	this.client.write("?RGB" + inputId + "\r");
}

/**
 * Set the listening mode
 */
Pioneer.prototype.listeningMode = function(mode) {
    this.client.write("MF\r");
};

Pioneer.prototype.queryaudioMode = function(mode) {
    this.client.write("?L\r");
};


function handleConnection(self, socket) {
    if (TRACE) {
        console.log("AVR: got connection.");
    }
    
    self.client.write("\r");    // wake
    setTimeout(function() {
    	self.querypower()
    	self.queryinput()
	self.queryaudioMode()
        self.emit("connect")
    }, 100);
   setInterval(function() {
        self.querypower();
    }, 270000);
   setInterval(function() {
        self.querymute();
    }, 330000);
   setInterval(function() {
        self.queryinput();
    }, 300000);
   setInterval(function() {
        self.queryaudioMode();
    }, 610000);
    self.socket = socket;
}

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
        if (!pwr) {
		updateDomo(145,0);
	}
	pow = pwr;
        self.emit("power", pwr);
    }
    else if (data.startsWith("VOL")) {   // volume status
        var vol = data.substr(3, 3);
        
        // translate to dB.
        var db = (parseInt(vol) - 161) / 2;
        
        if (TRACE) {
            console.log("AVR IN: volume " + db + "dB (" + vol + ")");
        }
        
        self.emit("volume", db);
    }
    else if (data.startsWith("MUT")) {   // mute status
        var mute = data.endsWith("0");  // MUT0 = muted, MUT1 = not muted
        if (TRACE) {
            console.log("AVR: mute: " + mute);
        }
        if (mute && pow && ext) {
		updateDomo(105,100);
	} else if (ext) {
		updateDomo(105,0);
	}
        self.emit("mute", mute);
    }
    else if (data.startsWith("FN")) {
        input = data.substr(2, 2);
        if (TRACE) {
            console.log("AVR input: " + input + " : " + self.inputNames[input]);
        }
        if(input == 22 && pow) {
		updateDomo(145,30);	// Playstation 4
        }else if(input == 4 && pow) {
		updateDomo(145,20);	// Playstation 3
        }else if(input == 15 && pow) {
		updateDomo(145,10);	// Nexus Player
        }else if(input == 24 && pow) {
		updateDomo(145,40);	// IP Cameras
        }
        self.emit("input", input, self.inputNames[input]);
    }
    else if (data.startsWith("SSA")) {
         if (TRACE && DETAIL) {
             console.log("got SSA: " + data);
         }
    }
    else if (data.startsWith("APR")) {
         if (TRACE && DETAIL) {
             console.log("got APR: " + data);
         }
    }
    else if (data.startsWith("BPR")) {
         if (TRACE && DETAIL) {
             console.log("got BPR: " + data);
         }
    }
    else if (data.startsWith("LM")) {       // listening mode
        var mode = data.substring(2);
	updateDomoText(audioMode[mode],167);
        if (TRACE) {
            console.log("AVR listening mode: " + audioMode[mode]);
        }
    }
    else if (data.startsWith("FL")) {       // FL display information
	var display = hex2a(data.substring(4)).trim();
         if (TRACE && DETAIL) {
             console.log("AVR FL: " + display);
         }
    }
    else if (data.startsWith("RGB")) {      // input name information. informs on input names
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

domoticz.on('connect', function () {
	domoticz.publish('avr-controller/connected', 'true');
	console.log("Domoticz MQTT: connected");
});

function updateDomo(id,lvl) {
	var 	cmd = "Set Level";
	if (lvl > 99) {
		cmd = "On";
	} else if (lvl < 1) {
		cmd = "Off";
	}
	var state = {
		'command': 'switchlight',
		'idx': id,
		'switchcmd': cmd,
		'level': lvl
	};
	domoticz.publish('domoticz/in', JSON.stringify(state))
	if(TRACE) {
		console.log('DOMO: ' + JSON.stringify(state));
	}
}

function updateDomoText(txt,id) {
	var state = {
		'command': 'udevice',
		'idx': id,
		'nvalue': 0,
		'svalue': txt
	};
	domoticz.publish('domoticz/in', JSON.stringify(state))
	if(TRACE) {
		console.log('DOMO: ' + JSON.stringify(state));
	}
}



function handleEnd(self) {
    if (TRACE) {
        console.log("AVR: connection ended");
    }
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

var pow = false;
var ext = true;

exports.Pioneer = Pioneer;
exports.Inputs = Inputs;
exports.pow = pow;
exports.ext = ext;

var audioMode = {
	"0101":"[)(]PLIIxMOVIE",
	"0102":"[)(]PLIIMOVIE",
	"0103":"[)(]PLIIxMUSIC",
	"0104":"[)(]PLIIMUSIC",
	"0105":"[)(]PLIIxGAME",
	"0106":"[)(]PLIIGAME",
	"0107":"[)(]PROLOGIC",
	"0108":"Neo:6CINEMA",
	"0109":"Neo:6MUSIC",
	"010a":"XMHDSurround",
	"010b":"NEURALSURR",
	"010c":"2chStraightDecode",
	"010d":"[)(]PLIIzHEIGHT",
	"010e":"WIDESURRMOVIE",
	"010f":"WIDESURRMUSIC",
	"0110":"STEREO",
	"0111":"Neo:XCINEMA",
	"0112":"Neo:XMUSIC",
	"0113":"Neo:XGAME",
	"0114":"NEURALSURROUND+Neo:XCINEMA",
	"0115":"NEURALSURROUND+Neo:XMUSIC",
	"0116":"NEURALSURROUND+Neo:XGAMES",
	"1101":"[)(]PLIIxMOVIE",
	"1102":"[)(]PLIIxMUSIC",
	"1103":"[)(]DIGITALEX",
	"1104":"DTS+Neo:6/DTS-HD+Neo:6",
	"1105":"ESMATRIX",
	"1106":"ESDISCRETE",
	"1107":"DTS-ES8ch",
	"1108":"multichStraightDecode",
	"1109":"[)(]PLIIzHEIGHT",
	"110a":"WIDESURRMOVIE",
	"110b":"WIDESURRMUSIC",
	"110c":"Neo:XCINEMA",
	"110d":"Neo:XMUSIC",
	"110e":"Neo:XGAME",
	"0201":"ACTION",
	"0202":"DRAMA",
	"0203":"SCI-FI",
	"0204":"MONOFILM",
	"0205":"ENT.SHOW",
	"0206":"EXPANDED",
	"0207":"TVSURROUND",
	"0208":"ADVANCEDGAME",
	"0209":"SPORTS",
	"020a":"CLASSICAL",
	"020b":"ROCK/POP",
	"020c":"UNPLUGGED",
	"020d":"EXT.STEREO",
	"020e":"PHONESSURR.",
	"020f":"FRONTSTAGESURROUNDADVANCEFOCUS",
	"0210":"FRONTSTAGESURROUNDADVANCEWIDE",
	"0211":"SOUNDRETRIEVERAIR",
	"0301":"[)(]PLIIxMOVIE+THX",
	"0302":"[)(]PLIIMOVIE+THX",
	"0303":"[)(]PL+THXCINEMA",
	"0304":"Neo:6CINEMA+THX",
	"0305":"THXCINEMA",
	"0306":"[)(]PLIIxMUSIC+THX",
	"0307":"[)(]PLIIMUSIC+THX",
	"0308":"[)(]PL+THXMUSIC",
	"0309":"Neo:6MUSIC+THX",
	"030a":"THXMUSIC",
	"030b":"[)(]PLIIxGAME+THX",
	"030c":"[)(]PLIIGAME+THX",
	"030d":"[)(]PL+THXGAMES",
	"030e":"THXULTRA2GAMES",
	"030f":"THXSELECT2GAMES",
	"0310":"THXGAMES",
	"0311":"[)(]PLIIz+THXCINEMA",
	"0312":"[)(]PLIIz+THXMUSIC",
	"0313":"[)(]PLIIz+THXGAMES",
	"0314":"Neo:XCINEMA+THXCINEMA",
	"0315":"Neo:XMUSIC+THXMUSIC",
	"0316":"Neo:XGAMES+THXGAMES",
	"1301":"THXSurrEX",
	"1302":"Neo:6+THXCINEMA",
	"1303":"ESMTRX+THXCINEMA",
	"1304":"ESDISC+THXCINEMA",
	"1305":"ES8ch+THXCINEMA",
	"1306":"[)(]PLIIxMOVIE+THX",
	"1307":"THXULTRA2CINEMA",
	"1308":"THXSELECT2CINEMA",
	"1309":"THXCINEMA",
	"130a":"Neo:6+THXMUSIC",
	"130b":"ESMTRX+THXMUSIC",
	"130c":"ESDISC+THXMUSIC",
	"130d":"ES8ch+THXMUSIC",
	"130e":"[)(]PLIIxMUSIC+THX",
	"130f":"THXULTRA2MUSIC",
	"1310":"THXSELECT2MUSIC",
	"1311":"THXMUSIC",
	"1312":"Neo:6+THXGAMES",
	"1313":"ESMTRX+THXGAMES",
	"1314":"ESDISC+THXGAMES",
	"1315":"ES8ch+THXGAMES",
	"1316":"[)(]EX+THXGAMES",
	"1317":"THXULTRA2GAMES",
	"1318":"THXSELECT2GAMES",
	"1319":"THXGAMES",
	"131a":"[)(]PLIIz+THXCINEMA",
	"131b":"[)(]PLIIz+THXMUSIC",
	"131c":"[)(]PLIIz+THXGAMES",
	"131d":"Neo:XCINEMA+THXCINEMA",
	"131e":"Neo:XMUSIC+THXMUSIC",
	"131f":"Neo:XGAME+THXGAMES",
	"0401":"STEREO",
	"0402":"[)(]PLIIMOVIE",
	"0403":"[)(]PLIIxMOVIE",
	"0404":"Neo:6CINEMA",
	"0405":"AUTO SURROUND (StraightDecode)",
	"0406":"[)(]DIGITALEX",
	"0407":"[)(]PLIIxMOVIE",
	"0408":"DTS+Neo:6",
	"0409":"ESMATRIX",
	"040a":"ESDISCRETE",
	"040b":"DTS-ES8ch",
	"040c":"XMHDSurround",
	"040d":"NEURALSURR",
	"040e":"RETRIEVERAIR",
	"040f":"Neo:XCINEMA",
	"0410":"Neo:XCINEMA",
	"0501":"STEREO",
	"0502":"[)(]PLIIMOVIE",
	"0503":"[)(]PLIIxMOVIE",
	"0504":"Neo:6CINEMA",
	"0505":"ALCStraightDecode",
	"0506":"[)(]DIGITALEX",
	"0507":"[)(]PLIIxMOVIE",
	"0508":"DTS+Neo:6",
	"0509":"ESMATRIX",
	"050a":"ESDISCRETE",
	"050b":"DTS-ES8ch",
	"050c":"XMHDSurround",
	"050d":"NEURALSURR",
	"050e":"RETRIEVERAIR",
	"050f":"Neo:XCINEMA",
	"0510":"Neo:XCINEMA",
	"0601":"STEREO",
	"0602":"[)(]PLIIMOVIE",
	"0603":"[)(]PLIIxMOVIE",
	"0604":"Neo:6CINEMA",
	"0605":"STREAMDIRECTNORMALStraightDecode",
	"0606":"[)(]DIGITALEX",
	"0607":"[)(]PLIIxMOVIE",
	"0608":"(nothing)",
	"0609":"ESMATRIX",
	"060a":"ESDISCRETE",
	"060b":"DTS-ES8ch",
	"060c":"Neo:XCINEMA",
	"060d":"Neo:XCINEMA",
	"0701":"STREAMDIRECTPURE2ch",
	"0702":"[)(]PLIIMOVIE",
	"0703":"[)(]PLIIxMOVIE",
	"0704":"Neo:6CINEMA",
	"0705":"STREAMDIRECTPUREStraightDecode",
	"0706":"[)(]DIGITALEX",
	"0707":"[)(]PLIIxMOVIE",
	"0708":"(nothing)",
	"0709":"ESMATRIX",
	"070a":"ESDISCRETE",
	"070b":"DTS-ES8ch",
	"070c":"Neo:XCINEMA",
	"070d":"Neo:XCINEMA",
	"0881":"OPTIMUM",
	"0e01":"HDMITHROUGH",
	"0f01":"MULTICHIN"
};
