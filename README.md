# ToDOs #

- [ ] work on dashboard.css style:
	- [ ] remove duplicate/obsolete entries (not used or already specified in css/dc.css)
	- [ ] consider whether to import fonts
	- [ ] check `reset/filter` logic
	- [ ] fix tooltip: it should mention type of delay (instead of year) and value
- [ ] add stacked bar chart for type of delays, i.e. ATC, weather, ...
- [ ] filter elements for bar chart
	- [ ] how to wrap long list, i.e. 'others' for country
- [ ] geo choropleth
	- [x] geojson for european countries and neighboroughs
	- [x] geojson for relevant (RP1) airports
	- [x] topojson
		* properties for geo: su_a3, iso_n3, name, geometry
		* properties for airports: name, gps_code (ICAO code), iata_code, geometry
	- [ ] airports on the map


# Technical details #

* GeoJSON of relevant European countries & Co.

  Used http://geojson-maps.kyd.com.au/ for a quick selection to get file `europ-plus.geo.json` from where extract list of countries (used in `Makefile`) using [jq](http://stedolan.github.com/jq):

  ```bash
  $ jq '.features[].properties.adm0_a3' europe-plus.geo.json | awk -v ORS=, 'BEGIN {a="\047"} { print $1 }' | sed -e 's/,$//g'
  ```

  It could have been done as explained by Mike Bostock in [Let's Make a Map](http://bost.ocks.org/mike/map/)

* list of ADs (used in `Makefile`)
	```bash
	$ cut -f 1 -d ';' data/RP1_AirportATFMArrivalDelays.csv | tail -n +2 | sort | uniq | awk -v ORS=, 'BEGIN {a="\047"} {print a $1 a}' | sed -e 's/,$//g'
	```

* grab table from the web via Google Spreadsheet; select the first cell and issue an [`IMPORTHTML`](https://support.google.com/docs/answer/3093339?hl=en-GB&rd=1):

  ```text
  =IMPORTHTML("http://en.wikipedia.org/wiki/International_Civil_Aviation_Organization_airport_code", "table", 0)
  ```

  This will retrieve the first (`0` parameter) table (`table` parameter) from a Wikipage entry.