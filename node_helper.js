/* jshint esversion: 6 */

const request = require('request');
const moment = require('moment');

var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start: function() {
    this.config = null;
    this.stockData = {};
  },

  socketNotificationReceived: function(noti, payload) {
    this.log("Socket notification received: "+noti);
    if (noti == "GET_STOCKDATA") {
      this.config = payload;
      if ( moment().isAfter(moment(this.config.inactive[0], "HH:mm")) || moment().isBefore(moment(this.config.inactive[1], "HH:mm"))) {
        this.log("Inactivity time. No Api calls between "+this.config.inactive[0]+" and "+this.config.inactive[1])
      } else {
        var inactivity = moment.duration()
        var interval = Math.round((24 * 60 * 60 * 1000) / 400)          //500 calls allowed in 24 hours
        var callArray = this.createAPICalls();
        var _this = this;
        _this.callAPI(this.config.symbols[counter[0]], this.config.movingAverages.ma, this.config.movingAverages.periods[counter[1]]);
        setInterval(() => {
          counter[1] += 1;
          if (counter[1] == _this.config.ma.length) {
            counter[0] += 1;
            counter[1] = 0;
          }
          if (counter[0] == _this.config.symbols.length) {
            counter[0] = 0;
          }
          _this.callAPI(this.config.symbols[counter[0]], this.config.ma[counter[1]]);
          _this.log("Counter: "+counter);
        }, interval)
      }
    }
  },

  //https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=MSFT&apikey=demo
  //https://www.alphavantage.co/query?function=EMA&symbol=MSFT&interval=weekly&time_period=10&series_type=open&apikey=demo

  createAPICalls: function() {
    var callArray = [];
    var ma = this.config.movingAverages;
    var func = "TIME_SERIES_" + this.config.chartInterval.toUpperCase();
    for (var s = 0; s < this.config.symbols.length; s++) {
      if (ma.ma != "") {
        for (m = 0; m < ma.periods; m++) {
          callArray.push([ma.ma, ma.periods[m], "&symbol=" + this.config.symbols[s] + "&function=" + func ])
        }
      }
    }
    return callArray;
  },

  callAPI: function(symbol, func) {
    var url = "https://www.alphavantage.co/query?symbol=" + symbol + "&apikey=" + this.config.apiKey;
    this.log("API Call: "+url);
    var _this = this
    var data = null;
    request(url, (error, response, body)=>{
      //this.log("[AVSTOCK] API is called - ", symbol)
      if (error) {
        _this.log("API Error: ", error);
        return;
      }
      data = JSON.parse(body);
      if (data.hasOwnProperty("Note")) {
        _this.log("Error: API Call limit exceeded.");
      }
      if (data.hasOwnProperty("Error Message")) {
        _this.log("Error:", data["Error Message"]);
      }
      if (data["Time Series (Daily)"]) {
        _this.log("Response is parsed - "+symbol)
        _this.processData(symbol, data);
      }
    })
  },


  processData: function(symbol, data) {
    // split the data set into ohlc and volume
    var series = data["Time Series (Daily)"],
      ohlc = [],
      volume = [];

    var keys = Object.keys(series);
    var dayLimit = (this.config.intervals > 90) ? 90 : this.config.intervals;
    keys = keys.slice(0, dayLimit).sort();

    for (var k in keys) {
      index = keys[k];
      ohlc.push([
        parseInt(moment(index).format("x")), // the date
        parseFloat(series[index]["1. open"]), // open
        parseFloat(series[index]["2. high"]), // high
        parseFloat(series[index]["3. low"]), // low
        parseFloat(series[index]["4. close"]) // close
      ]);

      volume.push([
        parseInt(moment(index).format("x")), // the date
        parseInt(series[index]["5. volume"]) // the volume
      ]);
    }
    this.log(ohlc);
    this.log(volume);
    this.sendSocketNotification("UPDATE_STOCK", {
      stock: symbol,
      data: {
        ohlc: ohlc,
        volume: volume
      }
    });
  },

  log: function (msg) {
    if (this.config && this.config.debug) {
      console.log(this.name + ":", JSON.stringify(msg));
    }
  },
})
