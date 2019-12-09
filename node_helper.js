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
    if (noti == "GET_STOCKDATA") {
      cfg = payload.config;
      var interval = parseInt((24 * 60 * 60 * 1000) / 490)          //500 calls allowed in 24 hours
      this.log(Math.Round(interval/1000));
      var counter = [0,0];
      var _this = this;
      setInterval(() => {
        _this.callAPI(cfg, cfg.stocks[counter[0]], cfg.ma[counter[1]]);
        counter[1] += 1;
        if (counter[1] == cfg.ma.length) {
          counter[0] += 1;
          counter[1] = 0;
        }
        if (counter[0] == cfg.stocks.length) {
          counter[0] = 0;
        }
        _this.log("Counter: "+counter);
      }, interval)
    }
  },

  callAPI: function(cfg, symbol, func) {
    var url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=";
    url += symbol + "&apikey=" + cfg.apiKey;

    request(url, (error, response, body)=>{
      //this.log("[AVSTOCK] API is called - ", symbol)
      var data = null;
      if (error) {
        this.log("API Error: ", error);
        return;
      }
      data = JSON.parse(body);
      if (data.hasOwnProperty("Note")) {
        this.log("[AVSTOCK] Error: API Call limit exceeded.");
      }
      if (data.hasOwnProperty("Error Message")) {
        this.log("[AVSTOCK] Error:", data["Error Message"]);
      }
      if (data["Time Series (Daily)"]) {
        //console.log("[AVSTOCK] Response is parsed - ", symbol)
        this.processData(symbol, data);
      }
    })
  },


  processData: function(symbol, data) {
    // split the data set into ohlc and volume
    var series = data["Time Series (Daily)"],
      ohlc = [],
      volume = [];

    var keys = Object.keys(series);
    var dayLimit = (this.config.chartDays > 90) ? 90 : this.config.chartDays;
    keys = keys.slice(0, dayLimit).sort();

    for (var k in keys) {
      index = keys[k];
      ohlc.push([
        moment(k, "YYYY-MM-DD").format("x"), // the date
        parseFloat(series[index]["1. open"]), // open
        parseFloat(series[index]["2. open"]), // high
        parseFloat(series[index]["3. open"]), // low
        parseFloat(series[index]["4. open"]) // close
      ]);

      volume.push([
        moment(k, "YYYY-MM-DD").format("x"), // the date
        parseInt(series[index]["5. open"]) // the volume
      ]);
    }
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
