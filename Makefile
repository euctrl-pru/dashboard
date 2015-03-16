TOPOJSON = node_modules/.bin/topojson
TOPOMERGE = node_modules/.bin/topojson-merge
# http://www.naturalearthdata.com/downloads/
NATURAL_EARTH_CDN = http://naciscdn.org/naturalearth

EU_PLUS_COUNTRIES='"ALB"','"AUT"','"BEL"','"BGR"','"BLR"','"CHE"','"BIH"','"CZE"',\
	'"DEU"','"ESP"','"EST"','"FIN"','"FRA"','"GBR"','"DNK"','"HUN"','"IRL"','"ISL"',\
	'"ITA"','"GRC"','"KOS"','"LUX"','"HRV"','"LTU"','"LVA"','"MKD"','"MDA"','"MNE"',\
	'"NLD"','"NOR"','"POL"','"PRT"','"ROU"','"RUS"','"SRB"','"SVK"','"SVN"','"SWE"',\
	'"UKR"','"DZA"','"EGY"','"LBY"','"MAR"','"TUN"','"ARM"','"AZE"','"CYP"','"CYN"',\
	'"GEO"','"IRQ"','"ISR"','"IRN"','"LBN"','"JOR"','"KAZ"','"SYR"','"PSX"','"TKM"',\
	'"UZB"','"TUR"'

AIRPORTS_RP1 := $(shell cut -f 1 -d ';' data/RP1_AirportATFMArrivalDelays.csv | \
	tail -n +2 | sort | uniq | \
	awk -v ORS=, 'BEGIN {a="\047"} {print a $$1 a}' | \
	sed -e 's/,$$//g')


all: topo/europe-10m-plus.topo.json topo/airports-rp1.topo.json

.SECONDARY:

zip/ne_10m_airports.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/10m/cultural/ne_10m_airports.zip" -o $@.download
	mv $@.download $@

zip/ne_10m_land.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/10m/physical/ne_10m_land.zip" -o $@.download
	mv $@.download $@

zip/ne_10m_%.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/10m/cultural/ne_10m_$*.zip" -o $@.download
	mv $@.download $@

zip/ne_50m_land.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/50m/physical/ne_50m_land.zip" -o $@.download
	mv $@.download $@

zip/ne_50m_%.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/50m/cultural/ne_50m_$*.zip" -o $@.download
	mv $@.download $@

# Admin 0 – land (3.17M)
shp/ne_%_land.shp: zip/ne_%_land.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	touch $@

# Admin 0 – countries (5.08M)
shp/ne_%_admin_0_countries.shp: zip/ne_%_admin_0_countries.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	touch $@

shp/ne_10m_airports.shp: zip/ne_10m_airports.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	touch $@

topo/airports-rp1.geo.json: shp/ne_10m_airports.shp
	mkdir -p $(dir $@)
	ogr2ogr -f GeoJSON \
		-sql "SELECT gps_code AS id, name, iata_code AS iata_id \
				FROM ne_10m_airports \
				WHERE gps_code IN ($(AIRPORTS_RP1))" \
		$@ \
		$<

topo/europe-%-plus.geo.json: shp/ne_%_admin_0_countries.shp
	mkdir -p $(dir $@)
	ogr2ogr -f GeoJSON \
		-sql "SELECT SU_A3 AS su_a3, NAME AS name, ISO_N3 AS iso_n3, ISO_A2 AS iso_a2 \
				FROM ne_10m_admin_0_countries \
				WHERE ADM0_A3 IN ($(EU_PLUS_COUNTRIES))" \
		$@ \
		$<

topo/europe-10m-plus.topo.json: topo/europe-10m-plus.geo.json
	mkdir -p $(dir $@)
	$(TOPOJSON) \
	--quantization 1e5 \
	--id-property +iso_n3 --properties name --properties su_a3 --properties iso_a2 \
	-o $@ \
	-- \
	countries=$<

topo/airports-rp1.topo.json: topo/airports-rp1.geo.json
	mkdir -p $(dir $@)
	$(TOPOJSON) \
		--quantization 1e5 \
		-o $@ \
		--id-property id --properties name --properties iata_id \
		-- \
		airports=$<
