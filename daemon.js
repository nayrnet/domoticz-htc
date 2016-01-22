#!/usr/bin/nodejs
// Starts and Stops the AVR Controller in the background.

var daemon = require("daemonize2").setup({
	main: "server.js",
	name: "AVR Controller Service",
	pidfile: "avrcontroller.pid"
});

switch (process.argv[2]) {

    case "start":
        daemon.start();
        break;

    case "stop":
        daemon.stop();
        break;

    default:
        console.log("Usage: [start|stop]");
}
