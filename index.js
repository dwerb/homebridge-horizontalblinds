var request = require("request");
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-horizontalblinds", "BlindsHTTP", BlindsHTTPAccessory);
}

function BlindsHTTPAccessory(log, config) {
    // global vars
    this.log = log;

    // configuration vars
    this.name = config["name"];
    this.upURL = config["up_url"];
    this.downURL = config["down_url"];
    this.tiltupURL = config["tilt_url"];
    this.httpMethod = config["http_method"] || "POST";

    // state vars
    this.lastPosition = 0; // last known position of the blinds, down by default
    this.currentPositionState = 2; // stopped by default
    this.currentTargetPosition = 0; // down by default
    this.targetHorizontalTiltAngle = 0; // open
    this.currentHorizontalTiltAngle = 0; // open
    

    // register the service and provide the functions
    this.service = new Service.WindowCovering(this.name);

    // the current position (0-100%)
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L493
    //this.service
    //    .getCharacteristic(Characteristic.CurrentPosition)
     //   .on('get', this.getCurrentPosition.bind(this));

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

    // the target horizontal tilt position (-90% to 90%) 
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L530
    this.service
        .getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
        .on('get', this.getCurrentHorizontalTiltAngle.bind(this))
  

    // the target horizontal tilt position (-90% to 90%) 
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L2116
    this.service
        .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
        .on('get', this.getTargetHorizontalTiltAngle.bind(this))
        .on('set', this.setTargetHorizontalTiltAngle.bind(this));
}

BlindsHTTPAccessory.prototype.getCurrentPosition = function(callback) {
    this.log("Requested CurrentPosition: %s", this.lastPosition);
    callback(null, this.lastPosition);
}

BlindsHTTPAccessory.prototype.getCurrentHorizontalTiltAngle = function(callback) {
    this.log("Requested CurrentHorizontalTiltAngle: %s", this.currentHorizontalTiltAngle);
    callback(null, this.currentHorizontalTiltAngle);
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
    this.log("Set TargetPosition: %s", pos);

    this.httpRequest((moveUp ? this.upURL : this.downURL), this.httpMethod, function() {
        this.log("Success moving %s", (moveUp ? "up (to 100)" : "down (to 0)"))
        this.service
            .setCharacteristic(Characteristic.CurrentPosition, (moveUp ? 100 : 0));
        this.service
            .setCharacteristic(Characteristic.PositionState, 2);
        this.lastPosition = (moveUp ? 100 : 0);

        callback(null);
    }.bind(this));
}

BlindsHTTPAccessory.prototype.getTargetHorizontalTiltAngle = function(pos, callback) {
    this.log("Requested TargetHorizontalTiltAngle: %s", this.currentHorizontalTiltAngle);
    callback(null, this.currentHorizontalTiltAngle);
}
BlindsHTTPAccessory.prototype.setTargetHorizontalTiltAngle = function(pos, callback) {
    this.log("Set TargetHorizontalTiltAngle: %s", pos);

    this.service
        .setCharacteristic(Characteristic.PositionState, (moveUp ? 1 : 0));

    this.httpRequest(this.tilt_url+"?angle=" + pos, this.httpMethod, function() {
        this.log("Success changing tile to %s", pos)
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
      callback(null);
    } else {
      this.log("Error getting state (status code %s): %s", response.statusCode, err);
      callback(err);
    }
  }.bind(this));
}

BlindsHTTPAccessory.prototype.getServices = function() {
  return [this.service];
}
