'use strict';

var request = require("request");
var Service, Characteristic, Battery;
var inherits = require("util").inherits;


module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    Battery = function() {
      Characteristic.call(this, 'Battery', 'D0000068-0000-1000-8000-0026BB765291');
      this.setProps({
        format: Characteristic.Formats.UINT32,
        maxValue: 10000,
        minValue: 0,
        minStep: 1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
      });
      this.value = this.getDefaultValue();
    };

    inherits(Battery, Characteristic);
    Battery.UUID = 'D0000068-0000-1000-8000-0026BB765291';

    homebridge.registerAccessory("homebridge-horizontalblinds", "BlindsHTTP", BlindsHTTPAccessory);
}


function BlindsHTTPAccessory(log, config) {
    // global vars
    this.log = log;

    // configuration vars
    this.name = config["name"];
    this.upURL = config["up_url"];
    this.downURL = config["down_url"];
    this.tiltURL = config["tilt_url"];
    this.propertiesURL = config["properties_url"];
    this.httpMethod = config["http_method"] || "GET";

    // state vars
    this.lastPosition = 0; // last known position of the blinds, down by default
    this.currentPositionState = 2; // stopped by default
    this.currentTargetPosition = 0; // down by default
    this.targetHorizontalTiltAngle = 0; // open
    this.currentHorizontalTiltAngle = 0; // open
    this.battery = 0;
    

    // register the service and provide the functions
    this.service = new Service.WindowCovering(this.name);

    // the current position (0-100%)
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L493
    this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));

    // the position state
    // 0 = DECREASING; 1 = INCREASING; 2 = STOPPED;
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1138
    this.service
        .getCharacteristic(Characteristic.PositionState)
        .on('get', this.getPositionState.bind(this));

    // the target position (0-100%)
    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .setProps({minValue: -90});

    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .setProps({maxValue: 90});

    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .setProps({minStep: 10});

    this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .setProps({minValue: -90});

    this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .setProps({maxValue: 90});

    // the target horizontal tilt position (-90% to 90%) 
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L530
    this.service
        .getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
        .on('get', this.getCurrentHorizontalTiltAngle.bind(this));
  

    // the target horizontal tilt position (-90% to 90%) 
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L2116
    this.service
        .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
        .on('get', this.getTargetHorizontalTiltAngle.bind(this))
        .on('set', this.setTargetHorizontalTiltAngle.bind(this));

    this.service
        .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
        .setProps({minStep: 10});

    this.service.addCharacteristic(Battery);

    this.service
        .getCharacteristic(Battery)
        .on('get', this.getBatteryLevel.bind(this)); 
}


BlindsHTTPAccessory.prototype.getCurrentPosition = function(callback) {
    this.log("Requested CurrentPosition: %s", this.lastPosition);
    callback(null, this.lastPosition);
}

BlindsHTTPAccessory.prototype.getBatteryLevel = function(callback) {
    this.log("Requested BatteryLevel: %s", this.battery);
    callback(null, this.battery);
}

BlindsHTTPAccessory.prototype.getCurrentHorizontalTiltAngle = function(callback) {
    request({
      method: this.httpMethod,
      url: this.propertiesURL,
    }, function(err, response, body) {
      if (!err && response.statusCode == 200) {
        this.log("response %s", response.body);
        var properties = JSON.parse(response.body);
        this.currentHorizontalTiltAngle = properties.currentangle;
        this.battery = properties.batterylevel;
        this.log("Requested CurrentHorizontalTiltAngle: %s", this.currentHorizontalTiltAngle);
        callback(null, this.currentHorizontalTiltAngle);
      } else {
        this.log("URL: %s", this.propertiesURL);
        this.log("Error getting state (status code %s): %s", response.statusCode, err);
        callback(err);
      }
    }.bind(this));    
}

BlindsHTTPAccessory.prototype.getPositionState = function(callback) {
    this.log("Requested PositionState: %s", this.currentPositionState);
    callback(null, this.currentPositionState);
}

BlindsHTTPAccessory.prototype.getTargetPosition = function(callback) {
    this.log("Requested TargetPosition: %s", this.currentTargetPosition);
    callback(null, this.currentTargetPosition);
}

BlindsHTTPAccessory.prototype.setTargetPosition = function(pos, callback) {
    this.log ("Requested Target Position: %s", pos);
    var target = 0;  
    if ((this.lastPosition == 50) && (pos == 0))
    {
        target = 100;
    }
    else if ((this.lastPosition == 0) && (pos == 100)) {
        target = 50;
    }
    else if (this.lastPosition <= 50) {
        if (pos >= 50) {
            target = 50;
        }
        else if (pos < 50) {
            target = 0;
        }
    }
    else if (this.lastPosition > 50){
        if (pos > 50) {
            target = 100;
        }
        else if (pos <= 50) {
            target = 50;
        }
    }

//    const targetangle = (target-100)*(0.9);
    const targetangle = (target-50)*(1.8);
    this.log("Set TargetPosition: %s", target);
    this.log("Setting Horizontal Angle: %s", targetangle);
    this.tiltBlinds(targetangle, function() { 
        this.service.setCharacteristic(Characteristic.CurrentPosition, target);
        this.service.setCharacteristic(Characteristic.PositionState, 2);
        this.lastPosition = target;
        callback(null);
    }.bind(this));
}

BlindsHTTPAccessory.prototype.getTargetHorizontalTiltAngle = function(callback) {
    this.log("Requested TargetHorizontalTiltAngle: %s", this.currentHorizontalTiltAngle);
    callback(null, this.currentHorizontalTiltAngle);
}

BlindsHTTPAccessory.prototype.setTargetHorizontalTiltAngle = function(pos, callback) {
    this.log("Set TargetHorizontalTiltAngle: %s", pos);

    this.tiltBlinds(pos, function() { 
        callback(null);
    }.bind(this));
/*    this.httpRequest(this.tiltURL+"?targetangle=" + pos, this.httpMethod, function() {
        this.log("Success changing tilt to %s", pos)
        this.service
            .setCharacteristic(Characteristic.CurrentHorizontalTiltAngle, pos);
        this.currentHorizontalTiltAngle = pos;

        callback(null);
    }.bind(this)); */
}

BlindsHTTPAccessory.prototype.tiltBlinds = function(pos, callback) {
    this.httpRequest(this.tiltURL+"?targetangle=" + pos, this.httpMethod, function() {
        this.log("Success changing tilt to %s", pos)
        this.service
            .setCharacteristic(Characteristic.CurrentHorizontalTiltAngle, pos);
        this.currentHorizontalTiltAngle = pos;

        callback(null);
    }.bind(this));
}

BlindsHTTPAccessory.prototype.httpRequest = function(url, method, callback) {
  request({
    method: method,
    url: url,
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      this.log(response.body);
      callback(null);
    } else {
      this.log("URL: %s", url);
      this.log("Error getting state (status code %s): %s", response.statusCode, err);
      callback(err);
    }
  }.bind(this));
}

BlindsHTTPAccessory.prototype.getServices = function() {
  return [this.service];
}
