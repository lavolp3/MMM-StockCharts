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
      //if ( moment().isAfter(moment(this.config.inactive[0], "HH:mm")) || moment().isBefore(moment(this.config.inactive[1], "HH:mm"))) {
      //  this.log("Inactivity time. No Api calls between "+this.config.inactive[0]+" and "+this.config.inactive[1]);
      //} else {
        var inactivity = moment.duration();  //NOT FINISHED
        var interval = Math.round((24 * 60 * 60 * 1000) / 500);          //500 calls allowed in 24 hours
        var callArray = this.prepareAPICalls();
        this.log("CallArray: "+callArray);
        var _this = this;
        this.callAPI(callArray[0]);
        setInterval(() => {
          counter = (counter == callArray.length-1) ? 0 : counter + 1;
          _this.callAPI(callArray[counter]);
          _this.log("Counter: "+counter);
        }, interval);
      //}
    }
  },

  //https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=MSFT&apikey=demo
  //https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=MSFT&apikey=demo
  //https://www.alphavantage.co/query?function=EMA&symbol=MSFT&interval=weekly&time_period=10&series_type=open&apikey=demo
  //https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=MSFT&interval=5min&apikey=demo


  prepareAPICalls: function() {
    var callArray = [];
    var conf = this.config;
    var symbol, func, interval, maPeriod;
    var ma = conf.movingAverages;
    for (var s = 0; s < conf.symbols.length; s++) {
      func = "TIME_SERIES_" + conf.chartInterval.toUpperCase();
      symbol = conf.symbols[s];
      interval = (func === "TIME_SERIES_INTRADAY") ? conf.intraDayInterval : "";
      callArray.push({
        symbol: symbol,
        func: func,
        interval: interval,
        maPeriod: ""
      });
      if (ma.ma != "") {
        func = ma.ma.toUpperCase();
        interval = conf.chartInterval;
        for (m = 0; m < ma.periods.length; m++) {
          callArray.push({
            symbol: symbol,
            func: func,
            interval: interval,
            maPeriod: ma.periods[m]
          });
        }
      }
    }
    return callArray;
  },

  callAPI: function(call) {
    var url = "https://www.alphavantage.co/query?function=" + call.func + "&symbol=" + call.symbol;
    url += (call.interval != "") ? ("&interval=" + call.interval) : "";
    url += (call.maPeriod != "") ? ("&time_period=" + call.maPeriod + "&series_type=" + this.config.seriesType) : "";
    url += "&apikey=" + this.config.apiKey;
    this.log("API Call: "+url);
    var _this = this;
    var data = null;
    request(url, (error, response, body)=>{
      if (error) {
        _this.log("API Error: ", error);
        return;
      }
      data = JSON.parse(body);
      if (data.hasOwnProperty("Note")) {
        _this.log("Error: API Call limit exceeded.");
      } else if (data.hasOwnProperty("Error Message")) {
        _this.log("Error: " + data["Error Message"]);
      } else {
        _this.log("Response parsed - " + call.symbol);
        _this.processData(call, data);
      }
    });
  },


  processData: function(call, data) {

    var series = [], keys = [];
    var dayLimit = (this.config.intervals > 180) ? 180 : this.config.intervals;

    if (call.func.includes("TIME_SERIES")) {
      switch (call.func) {
        case "TIME_SERIES_DAILY":
          funcType = "Time Series (Daily)";
          break;
        case "TIME_SERIES_WEEKLY":
          funcType = "Weekly Time Series";
          break;
        case "TIME_SERIES_MONTHLY":
          funcType = "Monthly Time Series";
          break;
        case "TIME_SERIES_INTRADAY":
          funcType = "Time Series (" + this.config.intraDayInterval + ")";
          break;
        case "EMA":
        case "SMA":
          funcType = "Technical Analysis: " + call.func;
          break;
        default:
          console.error("Error: Unknown chart function! Changing to daily chart interval. Please check your config entries!");
          funcType = "Time Series (Daily)";
      }
      series = data[funcType];
      keys = Object.keys(series).slice(0, dayLimit).sort();

      var processedData = {
        values: [],
        volume: [],
      };

      for (var k in keys) {
        index = keys[k];
        if (call.func.includes("TIME_SERIES")) {
          processedData.values.push([
            parseInt(moment(index).format("x")), // the date
            parseFloat(series[index]["1. open"]), // open
            parseFloat(series[index]["2. high"]), // high
            parseFloat(series[index]["3. low"]), // low
            parseFloat(series[index]["4. close"]) // close
          ]);
          processedData.volume.push([
            parseInt(moment(index).format("x")), // the date
            parseInt(series[index]["5. volume"]) // the volume
          ]);
        } else {
          processedData.values.push([
            parseInt(moment(index).format("x")), // the date
            parseFloat(series[index][call.func]), // EMA or SMA
          ]);
        }
      }
      //this.log(ohlc);
      //this.log(volume);
      //this.log("MAs: "+maValues);
      this.sendSocketNotification("UPDATE_STOCK", {
        call: call,
        data: processedData
      });
    } else {
      this.log("Error in processing call: Unknown function");
    }
  },

  log: function (msg) {
    if (this.config && this.config.debug) {
      console.log(this.name + ":", JSON.stringify(msg));
    }
  },
});
