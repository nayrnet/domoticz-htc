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
        console.log("turning power: " + on);
    }
    if (on) {
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
        console.log("turning mute: " + on);
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
        console.log("toggling mute");
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


function handleConnection(self, socket) {
    if (TRACE) {
        console.log("got connection.");
    }
    
    self.client.write("\r");    // wake
    setTimeout(function() {
    	self.querypower();
    	self.queryinput();
        self.emit("connect");
    }, 100);
   setInterval(function() {
        self.querypower();
    }, 250000);
   setInterval(function() {
        self.querymute();
    }, 350000);
   setInterval(function() {
        self.queryinput();
    }, 300000);
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
            console.log("got power: " + pwr);
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
            console.log("got volume: " + db + "dB (" + vol + ")");
        }
        
        self.emit("volume", db);
    }
    else if (data.startsWith("MUT")) {   // mute status
        var mute = data.endsWith("0");  // MUT0 = muted, MUT1 = not muted
        if (TRACE) {
            console.log("got mute: " + mute);
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
            console.log("got input: " + input + " : " + self.inputNames[input]);
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
        if (TRACE) {
            console.log("got listening mode: " + mode);
        }
    }
    else if (data.startsWith("FL")) {       // FL display information
         if (TRACE && DETAIL) {
             console.log("got FL: " + data);
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
                	console.log("set input " + input + " to " + self.inputNames[inputId]);
                }
                self.emit("inputName", inputId, self.inputNames[inputId]);
                break;
            }
        } 
    }
    else if (data.startsWith("RGC")) {
         if (TRACE && DETAIL) {
             console.log("got RGC: " + data);
         }
    }
    else if (data.startsWith("RGF")) {
         if (TRACE && DETAIL) {
             console.log("got RGF: " + data);
         }
    }
    else if (data.length > 0) {
        if (TRACE) {
            console.log("got data: " + data);
        }
    }
}

domoticz.on('connect', function () {
	domoticz.publish('avr-controller/connected', 'true');
	console.log("Domoticz MQTT: connected");
});

function updateDomo(id,lvl) {
	var 	val = "Off";
	if (lvl) {
		val = "On";
	}
	var state = {
		'command': 'switchlight',
		'idx': id,
		'switchcmd': val,
		'level': lvl
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
