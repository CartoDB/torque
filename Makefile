
UGLIFYJS=./node_modules/.bin/uglifyjs

JS_CLIENT_FILES= lib/torque/*.js \
	lib/torque/renderer/*.js \
	lib/torque/gmaps/*.js \
	lib/torque/leaflet/leaflet_tileloader_mixin.js \
	lib/torque/leaflet/canvas_layer.js \
	lib/torque/leaflet/torque.js 

all: dist/torque.js dist/torque.full.js

dist/torque.full.js: dist_folder dist/torque.uncompressed.js
	cat vendor/carto.js dist/torque.uncompressed.js > dist/_torque.full.js
	$(UGLIFYJS) dist/_torque.full.js > dist/torque.full.js 
	rm -rf dist/_torque.full.js

dist/torque.uncompressed.js: dist_folder $(JS_CLIENT_FILES)
	cat $(JS_CLIENT_FILES) > dist/torque.uncompressed.js

dist/torque.js: dist_folder dist/torque.uncompressed.js
	$(UGLIFYJS) dist/torque.uncompressed.js > dist/torque.js

dist_folder:
	mkdir -p dist

dist: dist_folder dist/torque.js

clean: 
	rm -rf dist

.PHONY: clean dist_folder

