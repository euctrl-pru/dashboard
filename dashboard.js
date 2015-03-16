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

    countries.forEach(function(d) {
      codes.some(function(n) {
        if (d.id == n.id) return d.properties.icao = n.icao;
      });
    });

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

    // DIMENSION: country
    var countryDimension = ndx.dimension(function(d) {
      return d.country;
    });
    var totalPerCountry = countryDimension.group().reduceSum(function(d) {return d.total_delay;});
    // print_filter(totalPerCountry);

    // DIMENSION: year
    var yearlyDimension = ndx.dimension(function(d) {
      return d.year;
    });
    var yearGroup = yearlyDimension.group();
    var averagedTotalPerYear = yearlyDimension.group().reduceSum(function(d) {return d.total_delay / d.atfm_arrivals;});
    // print_filter(totalPerYear);
    var atc_delay = yearlyDimension.group().reduceSum(function(d) {return d.atc_delay / d.atfm_arrivals;});
    var atc_other_delay = yearlyDimension.group().reduceSum(function(d) {return d.atc_other_delay / d.atfm_arrivals;});
    var weather_delay = yearlyDimension.group().reduceSum(function(d) {return d.weather_delay / d.atfm_arrivals;});
    var other_delay = yearlyDimension.group().reduceSum(function(d) {return d.other_delay / d.atfm_arrivals;});


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
      // .group(averagedTotalPerYear)
      // .valueAccessor(function(d) {
      //   return d.value/10000.0;
      // })
      .group(weather_delay, "Weather")
      .stack(atc_other_delay, "ATC Other", function(d) {return d.value;})
      .stack(atc_delay, "ATC", function (d) { return d.value; })
      .stack(other_delay, "Other", function(d){return d.value;})
      .legend(dc.legend().x(350).y(0).itemHeight(13).gap(5))
      // .elasticY(true)
      .centerBar(true)
      // .gap(1)
      .elasticY(true) // rescale Y axis when filtering
      .brushOn(false)
      .x(d3.time.scale().domain([minYear-1, maxYear+1]))
      .yAxisLabel("Delay per arrival (min)")
      .renderHorizontalGridLines(true);
    
    yearlyDelaysChart.xAxis().tickFormat(function (v) { return Math.floor(v); });
    yearlyDelaysChart.yAxis().ticks(5);
    
    
    
  
    //Determine the current version of dc with `dc.version`
    d3.selectAll('#jquery-version').text($.fn.jquery);
    d3.selectAll('#d3js-version').text(d3.version);
    d3.selectAll('#topojson-version').text(topojson.version);
    d3.selectAll('#queue-version').text(queue.version);
    d3.selectAll('#crossfilter-version').text(crossfilter.version);
    d3.selectAll('#dcjs-version').text(dc.version);
    d3.selectAll('#momentjs-version').text(moment.version);
    d3.selectAll('#underscore-version').text(_.VERSION);
    d3.selectAll('#select2-version').text("3.5.2");


    // draw!
    dc.renderAll();
  }
