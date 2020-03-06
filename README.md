# homebridge-jeedom
[![npm](https://img.shields.io/npm/v/homebridge-jeedom?style=for-the-badge)![npm](https://img.shields.io/npm/dt/homebridge-jeedom?style=for-the-badge)](https://npmjs.com/homebridge-jeedom)

[Jeedom](https://jeedom.com) plugin for [Homebridge](https://github.com/nfarina/homebridge)

### What this plugin does
This plugin allows you to run Jeedom commands via HomeKit. This means you can run a Jeedom commands just by telling Siri to do so. An example usage for this plugin would be to turn ON one Jeedom object, check if it’s on, and even shut it down when finished.

### How this plugin works
- `on_cmd`: This is the command executed when the switch is turned ON.
- `off_cmd`: This is the command executed when the switch is turned OFF.
- `state_cmd`: This is the command executed when Homebridge checks the state of the switch.

### Things to know about this plugin
This plugin can only run Jeedom commands. In order to test if your `on_cmd`, `off_cmd`, or `state_cmd` are valid commands you need to run them from your CLI. Please keep in mind you will want to run these commands from the same user that runs (or owns) the Homebridge service if different than your root user.

# Installation
1. Install Homebridge using `npm install -g homebridge`.
2. Install this plugin using `npm install -g homebridge-jeedom`.
3. Update your configuration file. See configuration sample below.

# Configuration
### Basic configuration
 ```
"platforms": [{
    "platform": "jeedom",
    "url": "http://192.168.1.6",
    "api_key": "De9yCByA9jua2yhJBMbFK1i4IyLw7y05"
}]
```
### Advanced configuration
 ```
"platforms": [{
    "platform": "jeedom",
    "name": "Jeedom",
    "url": "http://192.168.1.6",
    "api_key": "De9yCByA9jua2yhJBMbFK1i4IyLw7y05",
    "switches": [{
        "name" : "Desk light",
        "on_cmd": "312",
        "off_cmd": "313",
        "state_cmd": "311"
    }, {
        "name" : "Garage door",
        "on_cmd": "69",
        "off_cmd": "68",
        "state_cmd": "70",
        "polling": true,
        "interval": 5,
        "timeout": 10,
        "manufacturer": "Chamberlain",
        "model": "C450",
        "serial": "XXXXXXXXXXX"
    }]
}]
```
| Fields | Description | Required
| - | - | -
| platform | Must always be `jeedom`. | Yes
| name | For logging purposes. | No
| url | Jeedom server url. | Yes
| api_key | Jeedom api key. | Yes
| switches | Array of switch config (multiple switches supported). | Yes
| \|- name* | Name of your device. | Yes
| \|- on_cmd | Command to turn on your device. | No 
| \|- off_cmd | Command to turn off your device. | No 
| \|- state_cmd | Command to detect an ON state of your device. | No
| \|- polling | State polling (Default false). | No
| \|- interval | Polling interval in `s` (Default 1s). | No
| \|- timeout** | Commands execution timeout in `s` (Default 1s). | No
| \|- manufacturer | Manufacturer of your device. | No
| \|- model | Model of your device. | No
| \|- serial | Serial number of your device. | No

\* Changing the switch `name` in `config.json` will create a new switch instead of renaming the existing one in HomeKit. It's strongly recommended that you rename the switch using a HomeKit app only.

** Command execution is assumed 'Successful' if timeout occures.
