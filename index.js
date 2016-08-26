var request = require("request");
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-blinds", "BlindsHTTP", BlindsHTTPAccessory);
}

function BlindsHTTPAccessory(log, config) {
    // global vars
    this.log = log;

    // configuration vars
    this.name = config["name"];
    this.upURL = config["up_url"];
    this.downURL = config["down_url"];
    this.stopURL = config["stop_url"];
    this.httpMethod = config["http_method"] || "POST";

    // state vars
    this.lastPosition = 0; // last position of the blinds
    this.currentPositionState = 2; // stopped by default
    this.currentTargetPosition = 0; // 0 by default

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
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    // the hold position bool (for stop)
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L707
    this.service
        .getCharacteristic(Characteristic.HoldPosition)
        .on('set', this.sendStopSignal.bind(this));
}

BlindsHTTPAccessory.prototype.getCurrentPosition = function(callback) {
    callback(null, this.lastPosition);
}

BlindsHTTPAccessory.prototype.getPositionState = function(callback) {
    callback(null, this.currentPositionState);
}

BlindsHTTPAccessory.prototype.getTargetPosition = function(callback) {
    callback(null, this.currentTargetPosition);
}

BlindsHTTPAccessory.prototype.setTargetPosition = function(pos, callback) {
    this.currentTargetPosition = pos;
    moveUp = (this.currentTargetPosition >= this.lastPosition);

    this.service
        .setCharacteristic(Characteristic.PositionState, (moveUp ? 1 : 0));

    this.httpRequest((moveUp ? this.upURL : this.downURL), this.httpMethod, function () {
        this.service
            .setCharacteristic(Characteristic.CurrentPosition, (moveUp ? 0 : 100))
            .setCharacteristic(Characteristic.PositionState, 2);

        callback(null);
    });
}

BlindsHTTPAccessory.prototype.sendStopSignal = function(stop, callback) {
    this.httpRequest(this.stopURL, this.httpMethod, function() {
        this.service
            .setCharacteristic(Characteristic.PositionState, 2); // set to stopped
            .setCharacteristic(Characteristic.HoldPosition, false); // reset it
    });
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