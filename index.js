let Accessory, Service, Characteristic, UUIDGen, protocolModule;

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-jeedom", "jeedom", jeedomPlatform, true);
};

function jeedomPlatform(log, config, api) {
    this.log = log;
    this.config = config || {
        "platform": "jeedom"
    };
    this.formated_url = `${this.config.url}/core/api/jeeApi.php?apikey=${this.config.api_key}&type=cmd&id=`;
    this.switches = this.config.switches || [];

    this.accessories = {};
    this.polling = {};

    if (api) {
        this.api = api;
        this.api.on("didFinishLaunching", this.didFinishLaunching.bind(this));
    };

    if (this.config.url) protocolModule = require(this.config.url.split(":")[0]);
};

// Method to restore accessories from cache
jeedomPlatform.prototype.configureAccessory = function (accessory) {
    this.setService(accessory);
    this.accessories[accessory.context.name] = accessory;
};

// Method to setup accesories from config.json
jeedomPlatform.prototype.didFinishLaunching = function () {
    // Add or update accessories defined in config.json
    for (let i in this.switches) this.addAccessory(this.switches[i]);

    // Remove extra accessories in cache
    for (let name in this.accessories) {
        const accessory = this.accessories[name];
        if (!accessory.reachable) this.removeAccessory(accessory);
    };
};

// Method to add and update HomeKit accessories
jeedomPlatform.prototype.addAccessory = function (data) {
    this.log(`Initializing platform accessory ${data.name}...`);

    // Retrieve accessory from cache
    let accessory = this.accessories[data.name];

    if (!accessory) {
        // Setup accessory as SWITCH (8) category.
        accessory = new Accessory(data.name, UUIDGen.generate(data.name), 8);

        // Setup HomeKit switch service
        accessory.addService(Service.Switch, data.name);

        // New accessory is always reachable
        accessory.reachable = true;

        // Setup listeners for different switch events
        this.setService(accessory);

        // Register new accessory in HomeKit
        this.api.registerPlatformAccessories("homebridge-jeedom", "jeedom", [accessory]);

        // Store accessory in cache
        this.accessories[data.name] = accessory;
    };

    // Confirm variable type
    data.polling = data.polling === true;
    data.interval = parseInt(data.interval, 10) || 1;
    data.timeout = parseInt(data.timeout, 10) || 1;
    if (data.manufacturer) data.manufacturer = data.manufacturer.toString();
    if (data.model) data.model = data.model.toString();
    if (data.serial) data.serial = data.serial.toString();

    // Store and initialize variables into context
    const cache = accessory.context;
    cache.name = data.name;
    cache.on_cmd = data.on_cmd;
    cache.off_cmd = data.off_cmd;
    cache.state_cmd = data.state_cmd;
    cache.polling = data.polling;
    cache.interval = data.interval;
    cache.timeout = data.timeout;
    cache.manufacturer = data.manufacturer;
    cache.model = data.model;
    cache.serial = data.serial;
    if (cache.state === undefined) {
        cache.state = false;
        if (data.off_cmd && !data.on_cmd) cache.state = true;
    };

    // Retrieve initial state
    this.getInitState(accessory);

    // Configure state polling
    if (data.polling && data.state_cmd) this.statePolling(data.name);
};

// Method to remove accessories from HomeKit
jeedomPlatform.prototype.removeAccessory = function (accessory) {
    if (accessory) {
        const name = accessory.context.name;
        this.log(`${name} is removed from Homebridge.`);
        this.api.unregisterPlatformAccessories("homebridge-jeedom", "jeedom", [accessory]);
        delete this.accessories[name];
    };
};

// Method to setup listeners for different events
jeedomPlatform.prototype.setService = function (accessory) {
    accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on("get", this.getPowerState.bind(this, accessory.context))
        .on("set", this.setPowerState.bind(this, accessory.context));

    accessory.on("identify", this.identify.bind(this, accessory.context));
};

// Method to retrieve initial state
jeedomPlatform.prototype.getInitState = function (accessory) {
    // Update HomeKit accessory information
    accessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.FirmwareRevision, require("./package.json").version)
        .setCharacteristic(Characteristic.Manufacturer, accessory.context.manufacturer || "Dorian Eydoux")
        .setCharacteristic(Characteristic.Model, accessory.context.model || "homebridge-jeedom")
        .setCharacteristic(Characteristic.SerialNumber, accessory.context.serial || "Default-SerialNumber");

    // Retrieve initial state if polling is disabled
    if (!accessory.context.polling) {
        accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .getValue();
    };

    // Configured accessory is reachable
    accessory.updateReachability(true);
};

// Method to determine current state
jeedomPlatform.prototype.getState = function (thisSwitch, callback) {
    // Return cached state if no state_cmd provided
    if (thisSwitch.state_cmd === undefined) {
        callback(null, thisSwitch.state);
        return;
    };

    // Request to Jeedom server to detect state
    protocolModule.get(this.formated_url + thisSwitch.state_cmd, (response) => response.on("data", (chunk) => {
        const body = parseInt(JSON.parse(chunk), 10);
        let error;

        if (isNaN(body)) {
            error = "The returned value by Jeedom server isn't a number";

            this.log(`Failed to determine ${thisSwitch.name} state.`);
            this.log(error);
        };

        callback(error, Boolean(body));
    })).on("error", (error) => {
        this.log(`Failed to determine ${thisSwitch.name} state.`);
        this.log(error.message);

        callback(error);
    });
};

// Method to determine current state
jeedomPlatform.prototype.statePolling = function (name) {
    const accessory = this.accessories[name];
    const thisSwitch = accessory.context;

    // Clear polling
    clearTimeout(this.polling[name]);

    this.getState(thisSwitch, function (error, state) {
        // Update state if there's no error
        if (!error && state !== thisSwitch.state) {
            thisSwitch.state = state;
            accessory.getService(Service.Switch)
                .getCharacteristic(Characteristic.On)
                .getValue();
        };
    });

    // Setup for next polling
    this.polling[name] = setTimeout(this.statePolling.bind(this, name), thisSwitch.interval * 1000);
};

// Method to determine current state
jeedomPlatform.prototype.getPowerState = function (thisSwitch, callback) {
    const self = this;

    if (thisSwitch.polling) {
        // Get state directly from cache if polling is enabled
        this.log(`${thisSwitch.name} is ${thisSwitch.state ? "on" : "off"}.`);
        callback(null, thisSwitch.state);
    } else {
        // Check state if polling is disabled
        this.getState(thisSwitch, function (error, state) {
            // Update state if command exists
            if (thisSwitch.state_cmd) thisSwitch.state = state;
            if (!error) self.log(`${thisSwitch.name} is ${thisSwitch.state ? "on" : "off"}.`);
            callback(error, thisSwitch.state);
        });
    };
};

// Method to set state
jeedomPlatform.prototype.setPowerState = function (thisSwitch, state, callback) {
    const self = this,
        cmd = state ? thisSwitch.on_cmd : thisSwitch.off_cmd;
    let timer;

    // Request to Jeedom server to set state
    protocolModule.get(this.formated_url + cmd, () => {
        if (cmd) this.log(`${thisSwitch.name} is turned ${state ? "on" : "off"}.`);

        thisSwitch.state = state;

        // Restore switch after 1s if only one command exists
        if (!state ? thisSwitch.off_cmd : thisSwitch.on_cmd && !thisSwitch.state_cmd) {
            setTimeout(() => {
                this.accessories[thisSwitch.name].getService(Service.Switch)
                    .setCharacteristic(Characteristic.On, !state);
                this.log(`${thisSwitch.name} is turned to ${state ? "off" : "on"}, the init state because only one command exists.`);
            }, 1000);
        };

        if (timer) {
            clearTimeout(timer);
            callback(null);
        };
    }).on("error", (error) => {
        if (state !== thisSwitch.state) this.log(`Failed to turn ${state ? "on" : "off"} ${thisSwitch.name}.`);
        this.log(error);

        callback(error);
    });

    // Allow 1s to set state but otherwise assumes success
    timer = setTimeout(() => {
        timer = null;
        this.log(`Turning ${state ? "on" : "off"} ${thisSwitch.name} took too long [${thisSwitch.timeout}s], assuming success.`);
        callback();
    }, thisSwitch.timeout * 1000);
};

// Method to handle identify request
jeedomPlatform.prototype.identify = function (thisSwitch, paired, callback) {
    this.log(`${thisSwitch.name} identify requested!`);
    callback();
};

// Method to handle plugin configuration in HomeKit app
jeedomPlatform.prototype.configurationRequestHandler = function (context, request, callback) {
    if (request && request.type === "Terminate") return;

    // Instruction
    if (!context.step) {
        context.step = 1;
        callback({
            "type": "Interface",
            "interface": "instruction",
            "title": "Before You Start...",
            "detail": "Please make sure homebridge is running with elevated privileges.",
            "showNextButton": true
        });
    } else {
        switch (context.step) {
            case 1:
                // Operation choices
                var respDict = {
                    "type": "Interface",
                    "interface": "list",
                    "title": "What do you want to do?",
                    "items": [
                        "Add New Switch",
                        "Modify Existing Switch",
                        "Remove Existing Switch"
                    ]
                };

                context.step = 2;
                callback(respDict);
                break;
            case 2:
                var selection = request.response.selections[0];
                if (selection === 0) {
                    // Info for new accessory
                    var respDict = {
                        "type": "Interface",
                        "interface": "input",
                        "title": "New Switch",
                        "items": [{
                            "id": "name",
                            "title": "Name (Required)",
                            "placeholder": "HTPC"
                        }]
                    };

                    context.operation = 0;
                    context.step = 3;
                    callback(respDict);
                } else {
                    var names = Object.keys(this.accessories);

                    if (names.length > 0) {
                        // Select existing accessory for modification or removal
                        if (selection === 1) {
                            var title = "Witch switch do you want to modify?";
                            context.operation = 1;
                            context.step = 3;
                        } else {
                            var title = "Witch switch do you want to remove?";
                            context.step = 5;
                        };

                        var respDict = {
                            "type": "Interface",
                            "interface": "list",
                            "title": title,
                            "items": names
                        };

                        context.list = names;
                    } else {
                        // Error if not switch is configured
                        var respDict = {
                            "type": "Interface",
                            "interface": "instruction",
                            "title": "Unavailable",
                            "detail": "No switch is configured.",
                            "showNextButton": true
                        };

                        context.step = 1;
                    };
                    callback(respDict);
                };
                break;
            case 3:
                if (context.operation === 0) {
                    var data = request.response.inputs;
                } else if (context.operation === 1) {
                    var selection = context.list[request.response.selections[0]];
                    var data = this.accessories[selection].context;
                };

                if (data.name) {
                    // Add/Modify info of selected accessory
                    var respDict = {
                        "type": "Interface",
                        "interface": "input",
                        "title": data.name,
                        "items": [{
                                "id": "on_cmd",
                                "title": "CMD to Turn On",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "69"
                            }, {
                                "id": "off_cmd",
                                "title": "CMD to Turn Off",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "68"
                            }, {
                                "id": "state_cmd",
                                "title": "CMD to Check ON State",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "70"
                            }, {
                                "id": "polling",
                                "title": "Enable Polling (true/false)",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "false"
                            }, {
                                "id": "interval",
                                "title": "Polling Interval (s)",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "1"
                            },
                            {
                                "id": "timeout",
                                "title": "On/Off command execution timeout (s)",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "1"
                            }, {
                                "id": "manufacturer",
                                "title": "Manufacturer",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "Default-Manufacturer"
                            }, {
                                "id": "model",
                                "title": "Model",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "Default-Model"
                            }, {
                                "id": "serial",
                                "title": "Serial",
                                "placeholder": context.operation ? "Leave blank if unchanged" : "Default-SerialNumber"
                            }
                        ]
                    };

                    context.name = data.name;
                    context.step = 4;
                } else {
                    // Error if required info is missing
                    var respDict = {
                        "type": "Interface",
                        "interface": "instruction",
                        "title": "Error",
                        "detail": "Name of the switch is missing.",
                        "showNextButton": true
                    };

                    context.step = 1;
                };

                delete context.list;
                delete context.operation;
                callback(respDict);
                break;
            case 4:
                var userInputs = request.response.inputs;
                var newSwitch = {};

                // Clone context if switch exists
                if (this.accessories[context.name]) {
                    newSwitch = JSON.parse(JSON.stringify(this.accessories[context.name].context));
                };

                // Setup input for addAccessory
                newSwitch.name = context.name;
                newSwitch.on_cmd = userInputs.on_cmd || newSwitch.on_cmd;
                newSwitch.off_cmd = userInputs.off_cmd || newSwitch.off_cmd;
                newSwitch.state_cmd = userInputs.state_cmd || newSwitch.state_cmd;
                if (userInputs.polling.toUpperCase() === "TRUE") {
                    newSwitch.polling = true;
                } else if (userInputs.polling.toUpperCase() === "FALSE") {
                    newSwitch.polling = false;
                };
                newSwitch.interval = userInputs.interval || newSwitch.interval;
                newSwitch.timeout = userInputs.timeout || newSwitch.timeout;
                newSwitch.manufacturer = userInputs.manufacturer;
                newSwitch.model = userInputs.model;
                newSwitch.serial = userInputs.serial;

                // Register or update accessory in HomeKit
                this.addAccessory(newSwitch);
                var respDict = {
                    "type": "Interface",
                    "interface": "instruction",
                    "title": "Success",
                    "detail": "The new switch is now updated.",
                    "showNextButton": true
                };

                context.step = 6;
                callback(respDict);
                break;
            case 5:
                // Remove selected accessory from HomeKit
                var selection = context.list[request.response.selections[0]];
                var accessory = this.accessories[selection];

                this.removeAccessory(accessory);
                var respDict = {
                    "type": "Interface",
                    "interface": "instruction",
                    "title": "Success",
                    "detail": "The switch is now removed.",
                    "showNextButton": true
                };

                delete context.list;
                context.step = 6;
                callback(respDict);
                break;
            case 6:
                // Update config.json accordingly
                var self = this;
                delete context.step;
                var newConfig = this.config;

                // Create config for each switch
                var newSwitches = Object.keys(this.accessories).map(function (k) {
                    var accessory = self.accessories[k];
                    var data = {
                        "name": accessory.context.name,
                        "on_cmd": accessory.context.on_cmd,
                        "off_cmd": accessory.context.off_cmd,
                        "state_cmd": accessory.context.state_cmd,
                        "polling": accessory.context.polling,
                        "interval": accessory.context.interval,
                        "timeout": accessory.context.timeout,
                        "manufacturer": accessory.context.manufacturer,
                        "model": accessory.context.model,
                        "serial": accessory.context.serial
                    };
                    return data;
                });

                newConfig.switches = newSwitches;
                callback(null, "platform", true, newConfig);
                break;
        };
    };
};