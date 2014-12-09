
UGLIFYJS=./node_modules/.bin/uglifyjs
BROWSERIFY=./node_modules/browserify/bin/cmd.js

JS_CLIENT_FILES= lib/torque/*.js \
	lib/torque/renderer/*.js \
	lib/torque/gmaps/*.js \
	lib/torque/leaflet/leaflet_tileloader_mixin.js \
	lib/torque/leaflet/canvas_layer.js \
	lib/torque/leaflet/torque.js 

all: dist/torque.js dist/torque.full.js

dist/torque.full.js: dist_folder dist/torque.uncompressed.js
	$(BROWSERIFY) lib/torque/index.js --standalone torque > dist/_torque.full.js
	$(UGLIFYJS) dist/_torque.full.js > dist/torque.full.js
	rm -rf dist/_torque.full.js

dist/torque.uncompressed.js: dist_folder $(JS_CLIENT_FILES)
	$(BROWSERIFY) lib/torque/index.js --no-bundle-external --standalone torque > dist/torque.uncompressed.js

dist/torque.js: dist_folder dist/torque.uncompressed.js
	$(UGLIFYJS) dist/torque.uncompressed.js > dist/torque.js

dist_folder:
	mkdir -p dist

dist: dist_folder dist/torque.js

prepare-test-suite:
	browserify test/suite.js > test/suite-bundle.js

clean: 
	rm -rf dist

.PHONY: clean dist_folder
