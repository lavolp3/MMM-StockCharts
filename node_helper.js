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
	  var counter = 0;
      if ( moment().isAfter(moment(this.config.inactive[0], "HH:mm")) || moment().isBefore(moment(this.config.inactive[1], "HH:mm"))) {
        this.log("Inactivity time. No Api calls between "+this.config.inactive[0]+" and "+this.config.inactive[1])
      } else {
        var inactivity = moment.duration()
        var interval = Math.round((24 * 60 * 60 * 1000) / 400)          //500 calls allowed in 24 hours
        var callArray = this.createAPICalls();
        var _this = this;
        this.callAPI(callArray[0]);
        setInterval(() => {
          counter = (counter == callArray.length-1) ? 0 : counter + 1;
          _this.callAPI(callArray[counter]);
          _this.log("Counter: "+counter);
        }, interval)
      }
    }
  },

  //https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=MSFT&apikey=demo
  //https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=MSFT&apikey=demo
  //https://www.alphavantage.co/query?function=EMA&symbol=MSFT&interval=weekly&time_period=10&series_type=open&apikey=demo
  //https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=MSFT&interval=5min&apikey=demo
  

  createAPICalls: function() {
    var callArray = [];
    var conf = this.config;
    var symbol, func, interval, timePeriod;
    var ma = conf.movingAverages;
    for (var s = 0; s < conf.symbols.length; s++) {
	    func = "TIME_SERIES_" + conf.chartInterval.toUpperCase()
	    symbol = conf.symbols[s];
      interval = (func === "TIME_SERIES_INTRADAY") ? conf.dailyInterval : "";
	    callArray.push({
		    symbol: symbol,
		    func: func,
  		  interval: interval,
	  	  timePeriod: ""
	    });
      if (ma.ma != "") {
        interval = conf.chartInterval;
        for (m = 0; m < ma.periods.length; m++) {
          callArray.push({
		        symbol: symbol,
		        func: func,
		        interval: interval,
  		      timePeriod: ma.periods[m]
	        });
        }
      }
    }
    this.log(callArray);
    return callArray;
  },

  callAPI: function(call) {
    var url = "https://www.alphavantage.co/query?function=" + call.func 
	  + "?symbol=" + call.symbol 
	  + (call.timePeriod != "") ? ("&time_period" + call.timePeriod) : ""
	  + (call.interval != "") ? ("&interval" + call.interval) : ""
	  + "&apikey=" + this.config.apiKey;
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
      } else if (data.hasOwnProperty("Error Message")) {
        _this.log("Error:", data["Error Message"]);
      } else {
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
