# Node AVR Controller

This program communicates with my tv via rs232 and with my audio receiver via TCP-Socket. Volume/Mute/Power/Default input are all provided by a PowerMate USB Knob and it syncs up with my Home Automation platform.

This relieves me of a universal remote, each device has its own remote/gamepad and the PowerMate provides the missing functionality. The Nexus player is the primary device/remote and it has custom software to provide input changes and other functions missing on the bluetooth Android remote.

There is remote control via Web browser through a Domoticz Virtual Selector Switch. I have automation scripts in Domoticz that change depending on the state of the AVR, and others that can controll the AVR.

> Out of the box this solution is going to do very little for you, its very specific to my setup. However the code is free to copy and modify for your own uses.

### Hardware:
* Pioneer SC-1222-K
  * Google Nexus Player
  * Sony PlayStation 3
  * Sony PlayStation 4
  * Mini Super NVR (Display Only, no storage)
* Sharp Aquos LC-C3242U
* Griffin PowerMate NA16029

### Software:
* AVR Controller - ME!
* Domoticz - http://www.domoticz.com
* Debian Jessie w/NodeJS from NodeSource repository
* AndroidTV OSD Remote - https://github.com/nayrnet/androidtv-osd-remote

### PowerMate Functions: 
* Left/Right = Vol Down/Vol Up
* Quick tap = Mute toggle
* Double tap = Change to Nexus Input, power on if needed.
* Long hold = Power off
* Down and Left = Dim Living Room Lights.
* Down and Right = Brighten Living Room Lights.
* LED Pulse on Power/Input change, On/Off with TV & AVR.

### Files:
* server.js - The main app, if debugging you can run this directly from command line.
* daemon.js - This is app starts/stops the server.
* hardware/pioneeravr.js - Functions for AVR Commands and Monitoring.
* hardware/powermate.js - Functions for the PowerMate USB Knob.
* hardware/sharptv.js - Functions for TV Commands.
* screenshots/ - Images of Domoticz & Setup
* systemd/avrcontroller.service - SystemD Service for Starting/Restarting.

### Credits:
* My Pioneer-AVR Starting point: https://github.com/stormboy/node-pioneer-avr/blob/master/pioneer-avr.js
* My PowerMate Starting point: https://github.com/mattwelch/sonospowermate/blob/master/sonospowermate.js

### Web Screenshot:
Selector Switch:

![Domoticz Selector Switch](screenshots/screenshot-button.png)

Switch Config:

![Domoticz Switch Config](screenshots/screenshot-config.png)

#### TO-DO:
* AVR Display & Status in Domoticz
* Volume Slider in Domoticz
* MQTT Interface to Domoticz instead of HTTP Requests.

#### Support:
> No support provided or warranty impied, this project is avilable for educational use and my own personal tracking.
