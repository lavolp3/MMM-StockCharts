

Module.register("MMM-StockCharts", {
  defaults: {
    apiKey : "",
    timeFormat: "DD-MM HH:mm",
    symbols : ["MNKD"],
    alias: ["APPLE", "", "SAMSUNG Electronics"],
    updateInterval: 10 * 1000,
    chartDays: 60,
    decimals : 4,
    candleSticks: false,
    coloredCandles: true,
    ma: ["SMA"],           //can be "SMA" or "EMA"
    maPeriod: "200",         //can be any numerical value. 200 is common in stock analysis
    premiumAccount: false,   // To change poolInterval, set this to true - Only For Premium Account
    debug: true
  },

  stocks: {},

  getScripts: function() {
    return [this.file("node_modules/highcharts/highstock.js")];
  },

  getStyles: function() {
    return ["MMM-StockCharts.css"];
  },

  start: function() {
    console.log("Starting module: "+this.name);
    this.sendSocketNotification("GET_STOCKDATA", this.config);
    this.loaded = false;
    this.updateCycle();
  },

  updateCycle: function() {
    var self = this;
    var count = 0;
    setInterval(function() {
      self.log("Update...");
      if (self.loaded == true) {
        //if (self.stocks[self.config.symbols[count]].hasOwnProperty(data)) {
          self.drawChart(self.config.symbols[count]);
          self.log("Updating chart");
        //}
        count = (count == self.config.symbols.length - 1) ? 0 : count + 1;
      }
    }, self.config.updateInterval);
  },

  getDom: function() {
    var wrapper = document.createElement("div");
    wrapper.id = "stockChart";
    return wrapper;
  },

  socketNotificationReceived: function(noti, payload) {
    if (noti == "UPDATE_STOCK") {
      this.log(payload);
      if (this.config.symbols.includes(payload.stock)) {
        this.log("Updating stock data...");
        this.stocks[payload.stock] = payload.data;
        this.log(this.stocks);
        this.loaded = true;
      }
    }
  },

  getStockName: function(symbol) {
    var stockAlias = symbol;
    var i = this.config.symbols.indexOf(symbol);
    if (this.config.symbols.length == this.config.alias.length) {
      stockAlias = (this.config.alias[i]) ? this.config.alias[i] : stockAlias;
    }
    return stockAlias;
  },

  drawChart: function(stock) {
    this.log(this.stocks[stock]);
    // set the allowed units for data grouping
    groupingUnits = [[
      'week',                         // unit name
      [1]                             // allowed multiples
    ], [
      'month',
      [1, 2, 3, 4, 6]
    ]];

    // create the chart
    Highcharts.stockChart('stockChart', {
      rangeSelector: {
        selected: 1,
        enabled: false
      },

      title: {
        text: stock
      },

      yAxis: [{
        labels: {
          align: 'right',
          x: -3
        },
        title: {
          //text: 'OHLC'
        },
        height: '70%',
        lineWidth: 2,
        resize: {
          enabled: true
        }
      }, {
        labels: {
          align: 'right',
          x: -3
        },
        title: {
            //text: 'Volume'
        },
        top: '75%',
        height: '25%',
        offset: 0,
        lineWidth: 2
      }],

      tooltip: {
        split: true
      },

      exporting: {
    		enabled: false,
      },

      navigator: {
    		enabled: false,
      },
      scrollbar: {
    		enabled: false,
      },

      series: [{
        type: 'candlestick',
        name: stock,
        data: this.stocks[stock].ohlc,
        dataGrouping: {
          units: groupingUnits
        }
      }, {
        type: 'column',
        name: 'Volume',
        data: this.stocks[stock].volume,
        yAxis: 1,
        dataGrouping: {
          units: groupingUnits
        }
      }]
    });
  },


/*  prepareChart: function() {
    var wrapper = document.getElementById("stockChart");
    wrapper.innerHTML = "";

    var stock = document.createElement("div");
    stock.innerHTML = "";
    stock.id = "AVSTOCK_SERIES";
    stock.className = "stock";

    var symbol = document.createElement("div");
    symbol.className = "symbol";
    symbol.innerHTML = "Loading...";
    symbol.id = "symbol_series";

    var price = document.createElement("div");
    price.className = "price";
    price.innerHTML = "---";
    price.id = "price_series";

    var change = document.createElement("div");
    change.className = "change";
    change.innerHTML = "---";
    change.id = "change_series";

    var anchor = document.createElement("div");
    anchor.className = "anchor";

    anchor.appendChild(price);
    anchor.appendChild(change);

    stock.appendChild(symbol);
    stock.appendChild(anchor);
    wrapper.appendChild(stock);

    var cvs = document.createElement("canvas");
    cvs.id = "stockchart_canvas";
    wrapper.appendChild(cvs);

    var tl = document.createElement("div");
    tl.className = "tagline";
    tl.id = "AVSTOCK_TAGLINE";
    tl.innerHTML = "Last updated : ";
    wrapper.appendChild(tl)

    cvs = document.getElementById("AVSTOCK_CANVAS");
    cvs.width = cvs.clientWidth;
    cvs.height = cvs.clientHeight;
  },

  drawSeries: function(series) {
    var symbol = ""
    var co = []
    var changeV = 0
    var lastPrice = 0
    var requestTime = ""

    var cvs = document.getElementById("AVSTOCK_CANVAS")
    var ctx = cvs.getContext("2d")
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    //determine max, min etc. for graph size
    for(var i in series) {
      var s = series[i];
      co[i] = s.close;
      if (i == 0) {
        max = s.close;
        min = s.close;
        symbol = s.symbol;
        ud = s.candle;
        lastPrice = s.close;
        requestTime = s.requestTime;
      } else if (!this.config.candleSticks) {
        if (s.close > max) {
          max = s.close;
        }
        if (s.close < min) {
          min = s.close;
        }
      } else {
        if (s.high > max) {
          max = s.high;
        }
        if (s.low < min) {
          min = s.low;
        }
      }
      if (i == 1) {
          changeV = Math.round((lastPrice - s.close) * 10000) / 10000;
      }
    }

    ctx.beginPath();   //draw line or candle stick chart
    var xs = Math.round(((ctx.canvas.width)-10) / series.length);
    var x = 5;
    var y = 0;
    var y2 = 0;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    if (!this.config.candleSticks) {
      ctx.beginPath();
      for (i = 0; i < series.length; i++) {
        var t = series[i];
        var c = t.close;
        y = ctx.canvas.height - (((c - min) / (max - min)) * ctx.canvas.height);
        ctx.lineTo(x, y);
        x += xs;
      }
      ctx.stroke();
    } else {
      for (i = 0; i < series.length; i++) {
        ctx.lineWidth = 1;
        var t = series[i];
        y = ctx.canvas.height - (((t.high - min) / (max - min)) * ctx.canvas.height);
        y2 = ctx.canvas.height - (((t.low - min) / (max - min)) * ctx.canvas.height);
        ctx.beginPath();    //drawing the candlestick from t.high to t.low
        ctx.moveTo(x, y);
        ctx.lineTo(x, y2);
        ctx.stroke();
        ctx.beginPath();  //drawing the candle from t.open to t.close
        var rectMinY = ctx.canvas.height - (((Math.min (t.close, t.open) - min) / (max - min)) * ctx.canvas.height);
        var rectMaxY = ctx.canvas.height - (((Math.max (t.close, t.open) - min) / (max - min)) * ctx.canvas.height);
        if (this.config.coloredCandles) {
          ctx.fillStyle = ((t.close < t.open) ? "red" : "green");
        } else {
          ctx.fillStyle = ((t.close < t.open) ? "black" : "white");
        }
        ctx.fillRect(x-Math.round(xs/2)+2, rectMinY, xs-4, rectMaxY-rectMinY);      //filled black or white (or colored) candle written above the candlestick
        ctx.strokeRect(x-Math.round(xs/2)+2, rectMinY, xs-4, rectMaxY-rectMinY);   //white border
        x += xs;
      }
    }


    if (cfg.showMA) {
      ctx.beginPath();
      ctx.strokeStyle = "#11A6E2";
      for (i = 0; i < series.length; i++) {
        var t = series[i].ma;
        y = ctx.canvas.height - (((t - min) / (max - min)) * ctx.canvas.height);
        ctx.lineTo(x, y);
        x += xs;
      }
      ctx.stroke();
    }

    var stock = document.getElementById("symbol_series");
    stock.innerHTML = this.getStockName(symbol);
    var price = document.getElementById("price_series");
    price.innerHTML = ""
    var change = document.getElementById("change_series");
    change.innerHTML = changeV;

    var tr = document.getElementById("AVSTOCK_SERIES");
    tr.className = "animated stock " + ud;
    var tl = document.getElementById("AVSTOCK_TAGLINE");
    tl.innerHTML = "Last updated: " + requestTime;
    setTimeout(()=>{
      tr.className = "stock " + ud;
    }, 1500);
  },

*/

  log: function (msg) {
    if (this.config && this.config.debug) {
      console.log(this.name + ":", JSON.stringify(msg));
    }
  },
})
