# Domoticz Home Theatre Controller (domoticz-htc)

Modular NodeJS service interfaces with various Home Theatre hardware and Domoticz to provide a unified and hackable solution.

This program communicates with my tv via rs232 and with my audio receiver via TCP-Socket. Volume/Mute/Power/Default input are all provided by a PowerMate USB Knob. Communicaiton with Domoticz is done via MQTT API.

> I have completely redone this project so its more portable and easier to adopt.

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
* Mosquitto MQTT Broker

### Domoticz Devices:
* Input Selector - Change Video Inputs and Toggle Power
* Audio Mode Selector - Change the audio proccessor.
* Volume Slider - Toggle Mute and set volume level.
* Display - Text Sensor showing the front display.
* Audio Mode - Show current audio proccessor (may not always be the one you select).

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
* Volume Slider in Domoticz

#### Support:
> No support provided or warranty impied, this project is avilable for educational use and my own personal tracking.
