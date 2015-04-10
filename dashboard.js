'use strict';

var loading = d3.selectAll(".loading");
var countryChart = dc.pieChart('#country-chart');
var seasonChart = dc.pieChart('#season-chart');
var yearlyDelaysChart  = dc.barChart("#delay-chart");
var ifrChart  = dc.compositeChart("#ifr-chart");

var dsv = d3.dsv(";", "text/plain");
var numberFormat = d3.format(".2f");

// from http://www.codeproject.com/Articles/693841/Making-Dashboards-with-Dc-js-Part-Using-Crossfil
function print_filter(filter){
  var f = eval(filter);
  if (typeof(f.length) != "undefined") {} else {}
  if (typeof(f.top) != "undefined") { f = f.top(Infinity); } else {}
  if (typeof(f.dimension) != "undefined") { f = f.dimension(function(d) { return ""; }).top(Infinity); } else {}
  console.log(filter + 
    "(" + f.length + ") = " +
    JSON.stringify(f)
      .replace("[","[\n\t")
      .replace(/}\,/g,"},\n\t")
      .replace("]","\n]"));
}



queue()
  .defer(dsv,     "data/RP1_AirportATFMArrivalDelays.csv")
  .defer(d3.csv,  "data/RP1_IfrAnsp.csv")
  .defer(d3.csv,  "data/RP1_IfrMonthly.csv")
  .await(ready);


// this gets executed once the files have been asynchronously read
function ready(error, delays, ifr_ansp, ifr_monthly) {

  // **************   IFR   **************
  ifr_ansp.forEach(function(d){
    d.flts_2013 = +d.flts_2013;
    d.avg_day_2013 = +d.avg_day_2013;
    d.flts_2014 = +d.flts_2014;
    d.avg_day_2014 = +d.avg_day_2014;
    d.change_percent = +d.change_percent;
  });

  ifr_monthly.forEach(function(d){
    d.year = +d.year;
    d.month = +d.month;
    d.days = +d.days;
    d.ifr_flights = +d.ifr_flights;
  })


  var xf_ifrM = crossfilter(ifr_monthly);
  var all = xf_ifrM.groupAll();


  // DIMENSION: year
  var yearlyIfrDimension = xf_ifrM.dimension(function(d) {return d.year;});
  var minYearIfr = yearlyIfrDimension.bottom(1)[0].year;
  var maxYearIfr = yearlyIfrDimension.top(1)[0].year;

  var avg = [];
  avg[2007] = 26541.117486338797; // so to make % change for 2008 = zero

  // maintain running tallies by year as filters are applied or removed
  var yearlyIfrPerformanceGroup = yearlyIfrDimension.group().reduce(
    /* callback for when data is added to the current filter results */
    function (p, v) {
      p.flights += v.ifr_flights;
      p.days    += v.days;
      p.avg     = p.days ? p.flights / p.days : 0;
      avg[v.year] = p.avg;
      var t = (avg[v.year - 1]) ? avg[v.year - 1] : 1;
      p.pc = 100 * (p.avg - t) / t;
      return p;
    },
    /* callback for when data is removed from the current filter results */
    function (p, v) {
      p.flights -= v.ifr_flights;
      p.days    -= v.days;
      p.avg     = p.days ? p.flights / p.days : 0;
      p.pc      = 100* (p.avg - ref) / ref;
      return p;
    },
    /* initialize p */
    function () {
      return {
        flights : 0,
        days    : 0,
        avg     : 0,
        pc      : 0
      };
    }
  );
  // print_filter(yearlyIfrPerformanceGroup);
  
var compose1 =  dc.lineChart(ifrChart)
      .brushOn(false)
      .clipPadding(10)
      .group(yearlyIfrPerformanceGroup, 'Average Daily IFR Flights')
      .valueAccessor(function(d) {return d.value.avg / 1000;})
      .renderArea(false)
      .renderDataPoints(true)
      .title(function(d) { return d.key + ': ' + d3.round(d.value.avg, 0) + ' flights';});
      // .colors(d3.scale.ordinal().range(['blue', 'green', 'yellow']));


var compose2 = dc.lineChart(ifrChart)
      .dimension(yearlyIfrDimension)
      .group(yearlyIfrPerformanceGroup, "YoY % change")
      .valueAccessor(function(d) {return d.value.pc;})
      .title(function(d){return d.key + ': ' + d3.round(d.value.pc, 1) + '%';})
      .renderDataPoints(true)
      .useRightYAxis(true)
      .dashStyle([5,5]);

// var zero = yearlyIfrDimension.group().reduceSum(function(d) {return 0;});
// print_filter(zero);
// var compose3 = dc.lineChart(ifrChart)
//       .dimension(yearlyIfrDimension)
//       .colors(d3.scale.ordinal().range(['black']))
//       .group(zero, "zero % change")
//       .valueAccessor(function(d) {return d.value;})
//       .renderTitle(false)
//       .renderLabel(false)
//       .useRightYAxis(true);


  ifrChart
    .width(500)
    .height(300)
    .margins({top: 10, right: 50, bottom: 30, left: 40})
    .xAxisLabel("Year")
    .x(d3.time.scale().domain([minYearIfr, maxYearIfr]))
    .round(d3.time.year.round)
    .xUnits(d3.time.years)
    .dimension(yearlyIfrDimension)
      .renderHorizontalGridLines(true)
      .legend(dc.legend().x(70).y(10).itemHeight(13).gap(5))
      .brushOn(false)
    .y(d3.scale.linear().domain([20, 30]))      // NOTE: hardocded knowing the Y range
    .rightY(d3.scale.linear().domain([-7, +3])) // NOTE: hardocded knowing the Y range
    .yAxisLabel("Avg. daily IFR Flights (x1000)")
    .rightYAxisLabel("year over year % change")
    .colors(d3.scale.ordinal().range(['blue', 'green', 'yellow']))
    .shareColors(true)
    .shareTitle(false)
    .compose([ compose1, compose2
      // , compose3
      ]);

  ifrChart.xAxis().ticks(5).tickFormat(d3.format("d"));


  // ************** DELAYS **************
  delays.forEach(function(d){
    d.country = d.ad.substring(0, 2);
    // cast to numbers
    d.year = +d.year;
    d.month = +d.month;
    d.atfm_arrivals = +d.atfm_arrivals;
    d.total_delay = +d.total_delay;
    d.atc_delay = +d.atc_delay;
    d.atc_other_delay = +d.atc_other_delay;
    d.weather_delay = +d.weather_delay;
    d.other_delay = +d.other_delay;
  });

  var xf_delays = crossfilter(delays);
  var all = xf_delays.groupAll();

  // DIMENSION: country
  var countryDimension = xf_delays.dimension(function(d) {return d.country;});
  var totalPerCountry = countryDimension.group().reduceSum(function(d) {return d.total_delay;});
  // print_filter(totalPerCountry);

  countryChart.width(180)
    .height(180)
    .radius(80)
    .innerRadius(20)
    .slicesCap(8) // display only subset, 8, of slices
    .colors(d3.scale.category20b())
    // .colors(colorbrewer.Paired[9]) // NOTE: strangely with latest dc.js it does not work
    .dimension(countryDimension)
    .group(totalPerCountry);



  // DIMENSION: year
  var yearlyDelayDimension = xf_delays.dimension(function(d) {return d.year;});
  var minYearDelay = yearlyDelayDimension.bottom(1)[0].year;
  var maxYearDelay = yearlyDelayDimension.top(1)[0].year;

  // maintain running tallies by year as filters are applied or removed
  var yearlyDelayPerformanceGroup = yearlyDelayDimension.group().reduce(
    /* callback for when data is added to the current filter results */
    function (p, v) {
      p.arrivals        += v.atfm_arrivals;
      p.total_delay     += v.total_delay;
      p.tot_atc_delay       += v.atc_delay;
      p.tot_atc_other_delay += v.atc_other_delay;
      p.tot_weather_delay   += v.weather_delay;
      p.tot_other_delay     += v.other_delay;

      p.avg_delay           = p.arrivals ? p.total_delay / p.arrivals         : 0;
      p.avg_atc_delay       = p.arrivals ? p.tot_atc_delay / p.arrivals       : 0;
      p.avg_atc_other_delay = p.arrivals ? p.tot_atc_other_delay / p.arrivals : 0;
      p.avg_weather_delay   = p.arrivals ? p.tot_weather_delay / p.arrivals   : 0;
      p.avg_other_delay     = p.arrivals ? p.tot_other_delay / p.arrivals     : 0;
      return p;
    },
    /* callback for when data is removed from the current filter results */
    function (p, v) {
      p.arrivals        -= v.atfm_arrivals;
      p.total_delay     -= v.total_delay;
      p.tot_atc_delay       -= v.atc_delay;
      p.tot_atc_other_delay -= v.atc_other_delay;
      p.tot_weather_delay   -= v.weather_delay;
      p.tot_other_delay     -= v.other_delay;

      p.avg_delay           = p.arrivals ? p.total_delay / p.arrivals         : 0;
      p.avg_atc_delay       = p.arrivals ? p.tot_atc_delay / p.arrivals       : 0;
      p.avg_atc_other_delay = p.arrivals ? p.tot_atc_other_delay / p.arrivals : 0;
      p.avg_weather_delay   = p.arrivals ? p.tot_weather_delay / p.arrivals   : 0;
      p.avg_other_delay     = p.arrivals ? p.tot_other_delay / p.arrivals     : 0;
      return p;
    },
    /* initialize p */
    function () {
      return {
        arrivals           : 0,
        total_delay        : 0,
        tot_atc_delay      : 0,
        tot_atc_other_delay: 0,
        tot_weather_delay  : 0,
        tot_other_delay    : 0,

        avg_delay          : 0,
        avg_atc_delay      : 0,
        avg_atc_other_delay: 0,
        avg_weather_delay  : 0,
        avg_other_delay    : 0
      };
    }
  );
  // print_filter(yearlyDelayPerformanceGroup);

  yearlyDelaysChart
    .width(500).height(200)
    .margins({top: 10, right: 50, bottom: 30, left: 40})
    .dimension(yearlyDelayDimension)
    .group(yearlyDelayPerformanceGroup, "Weather")
    .valueAccessor(function(d) {return d.value.avg_weather_delay;})
    .stack(yearlyDelayPerformanceGroup, "ATC Other", function(d) {return d.value.avg_atc_other_delay;})
    .stack(yearlyDelayPerformanceGroup, "ATC", function (d) { return d.value.avg_atc_delay; })
    .stack(yearlyDelayPerformanceGroup, "Other", function(d){return d.value.avg_other_delay;})
    .legend(dc.legend().x(350).y(0).itemHeight(13).gap(5))
    // .elasticY(true)
    .centerBar(true)
    .gap(2)
    .elasticY(true) // rescale Y axis when filtering
    .brushOn(false)
    .x(d3.time.scale().domain([minYearDelay - 1, maxYearDelay + 1]))
    .yAxisLabel("Delay per arrival (min)")
    .title(function(d) {
      return d.x + ": " + numberFormat(d.y) + " of " + numberFormat(d.value.avg_delay) + ".";
    })
    .renderHorizontalGridLines(true);
  
  yearlyDelaysChart.xAxis().tickFormat(function (v) { return Math.floor(v); });
  yearlyDelaysChart.yAxis().ticks(5);



  // DIMENSION: summer/winter season
  // from IATA:
  // The northern summer season begins on the date of Daylight Saving Time (DST) introduction
  // in European Union countries, which currently always takes place on the last Sunday in March.
  // The northern winter season commences on the date Daylight Saving Time (DST) ends
  // in European Union countries, which currently always takes place on the last Sunday in October.

  // create categorical dimension for summer/winter season (approximated, i.e. Apr-Oct = summer)
  var seasonDimension = xf_delays.dimension(function (d) {
    return _.includes([4,5,6,7,8,9,10], d.month)  ? 'Summer' : 'Winter';
  });
  // produce counts records in the dimension
  var seasonGroup = seasonDimension.group();

  seasonChart.width(180)
    .height(180)
    .radius(80)
    .innerRadius(20)
    .dimension(seasonDimension)
    .group(seasonGroup);
  



  // hide the "Loading..." text
  loading.classed("hidden", true);
  
  
  

  //Determine the versions of the libraries used
  d3.selectAll('#d3js-version').text(d3.version);
  d3.selectAll('#topojson-version').text(topojson.version);
  d3.selectAll('#queue-version').text(queue.version);
  d3.selectAll('#crossfilter-version').text(crossfilter.version);
  d3.selectAll('#dcjs-version').text(dc.version);
  d3.selectAll('#momentjs-version').text(moment.version);
  d3.selectAll('#underscore-version').text(_.VERSION);

  // not needed if select2 is not used. NOTE: see relevant ids in index.html!
  // d3.selectAll('#select2-version').text("3.5.2");
  // d3.selectAll('#jquery-version').text($.fn.jquery);

  // draw!
  dc.renderAll();

}
