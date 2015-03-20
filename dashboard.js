'use strict';

var countryChart = dc.pieChart('#country-chart');
var seasonChart = dc.pieChart('#season-chart');
// var euChart  = dc.geoChoroplethChart("#eu-chart");


var dsv = d3.dsv(";", "text/plain");
var dateFormat = d3.time.format.utc("%Y-%m-%dT%H:%M:%S.%LZ");
var numberFormat = d3.format(".2f");

// from http://www.codeproject.com/Articles/693841/Making-Dashboards-with-Dc-js-Part-Using-Crossfil
var print_filter = function(filter) {

  var f = eval(filter);

  if (typeof(f.length) != "undefined") {} else {}
  if (typeof(f.top) != "undefined") {f = f.top(Infinity);} else {}
  if (typeof(f.dimension) != "undefined") {f = f.dimension(function(d) { return "";}).top(Infinity);} else {}
  console.log(filter + "(" + f.length + ") = " + 
    JSON.stringify(f)
    .replace("[", "[\n\t")
    .replace(/}\,/g,"},\n\t")
    .replace("]","\n]")
  );
};



queue()
  .defer(d3.json, "data/europe-10m-plus.topo.json")
  .defer(dsv,     "data/RP1_AirportATFMArrivalDelays.csv")
  .defer(d3.json, "data/airports-rp1.topo.json")
  .defer(d3.tsv,     "data/eurocontrol_members.tsv")
  .defer(d3.tsv,     "data/IcaoCountryCodes.tsv")
  .await(ready);


  // this gets executed once the files have been asynchronously read
  function ready(error, euplus, delays, ads, euctrl, codes) {
    var countries = topojson.feature(euplus, euplus.objects.countries).features;
    var borders = topojson.mesh(euplus, euplus.objects.countries, function(a, b) { return a.id !== b.id; });
    var airports = topojson.feature(ads, ads.objects.airports).features;

    // console.log(JSON.stringify(codes)
    //   .replace("[", "[\n\t")
    //   .replace(/}\,/g,"},\n\t")
    //   .replace("]","\n]")
    // );

    // console.log(JSON.stringify(euctrl)
    //   .replace("[", "[\n\t")
    //   .replace(/}\,/g,"},\n\t")
    //   .replace("]","\n]")
    // );

    countries.forEach(function(d) {
      codes.some(function(n) {
        if (d.id == n.id) return d.properties.icao = n.icao;
      });
    });

    /* since its a csv file we need to format the data a bit */
    var df = d3.time.format('%m/%Y');

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

    var ndx = crossfilter(delays);
    var all = ndx.groupAll();

    // DIMENSION: country
    var countryDimension = ndx.dimension(function(d) {return d.country;});
    var totalPerCountry = countryDimension.group().reduceSum(function(d) {return d.total_delay;});
    // print_filter(totalPerCountry);

    // DIMENSION: year
    var yearlyDimension = ndx.dimension(function(d) {return d.year;});

    // maintain running tallies by year as filters are applied or removed
    var yearlyPerformanceGroup = yearlyDimension.group().reduce(
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
    // print_filter(yearlyPerformanceGroup);

    var yearGroup = yearlyDimension.group();

    var totalPerYear = yearlyDimension.group().reduceSum(function(d) {return d.total_delay;});
    // print_filter(totalPerYear);
    var atc_delay = yearlyDimension.group().reduceSum(function(d) {return d.atc_delay / d.atfm_arrivals;});
    // print_filter(atc_delay);
    var atc_other_delay = yearlyDimension.group().reduceSum(function(d) {return d.atc_other_delay / d.atfm_arrivals;});
    // print_filter(atc_other_delay);
    var weather_delay = yearlyDimension.group().reduceSum(function(d) {return d.weather_delay / d.atfm_arrivals;});
    // print_filter(weather_delay);
    var other_delay = yearlyDimension.group().reduceSum(function(d) {return d.other_delay / d.atfm_arrivals;});
    // print_filter(other_delay);


    // DIMENSION: month
    var monthlyDimension = ndx.dimension(function(d) {
      return d.month;
    });
    var totalPerMonth = monthlyDimension.group().reduceSum(function(d) {return d.total_delay;});
    // print_filter(totalPerMonth);


    // DIMENSION: summer/winter season
    // from IATA:
    // The northern summer season begins on the date of Daylight Saving Time (DST) introduction
    // in European Union countries, which currently always takes place on the last Sunday in March.
    // The northern winter season commences on the date Daylight Saving Time (DST) ends
    // in European Union countries, which currently always takes place on the last Sunday in October.

    // create categorical dimension for summer/winter season (approximated, i.e. Apr-Oct = summer)
    var seasonDimension = ndx.dimension(function (d) {
      return _.includes([4,5,6,7,8,9,10], d.month)  ? 'Summer' : 'Winter';
    });
    // produce counts records in the dimension
    var seasonGroup = seasonDimension.group();
    
    var minYear = yearlyDimension.bottom(1)[0].year;
    var maxYear = yearlyDimension.top(1)[0].year;

    // euChart.width(990)
    //         .height(500)
    //         .dimension(countryDimension)
    //         .group(totalPerCountry)
    //         .colors(d3.scale.quantize()
    //           .range(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF",
    //                   "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"]))
    //         .colorDomain([0, 200])
    //         .colorCalculator(function (d) { return d ? euChart.colors()(d) : '#ccc'; })
    //         .overlayGeoJson(countries, "country", function (d) {
    //           return d.properties.icao;
    //         })
    //         .title(function (d) {
    //             return "Country: " + d.key + "\nTotal ATFM arrival delay: " + numberFormat(d.value ? d.value : 0) + "min";
    //         });


    countryChart.width(180)
      .height(180)
      .radius(80)
      .innerRadius(20)
      .slicesCap(8) // display only subset of slices
      .colors(colorbrewer.Paired[9])
      .dimension(countryDimension)
      .group(totalPerCountry);

    seasonChart.width(180)
      .height(180)
      .radius(80)
      .innerRadius(20)
      .dimension(seasonDimension)
      .group(seasonGroup);
    
    var yearlyDelaysChart  = dc.barChart("#delay-chart");
    yearlyDelaysChart
      .width(500).height(200)
      .margins({top: 10, right: 50, bottom: 30, left: 40})
      .dimension(yearlyDimension)
      .group(yearlyPerformanceGroup, "Weather")
      .valueAccessor(function(d) {return d.value.avg_weather_delay;})
      .stack(yearlyPerformanceGroup, "ATC Other", function(d) {return d.value.avg_atc_other_delay;})
      .stack(yearlyPerformanceGroup, "ATC", function (d) { return d.value.avg_atc_delay; })
      .stack(yearlyPerformanceGroup, "Other", function(d){return d.value.avg_other_delay;})
      .legend(dc.legend().x(350).y(0).itemHeight(13).gap(5))
      // .elasticY(true)
      .centerBar(true)
      .gap(2)
      .elasticY(true) // rescale Y axis when filtering
      .brushOn(false)
      .x(d3.time.scale().domain([minYear-1, maxYear+1]))
      .yAxisLabel("Delay per arrival (min)")
      .title(function(d) {
          return d.x + ": " + numberFormat(d.y) + " of " + numberFormat(d.data.value.avg_delay) + ".";
      })
      .renderHorizontalGridLines(true);
    
    yearlyDelaysChart.xAxis().tickFormat(function (v) { return Math.floor(v); });
    yearlyDelaysChart.yAxis().ticks(5);
    
    
    
  
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
