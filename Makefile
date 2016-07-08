
UGLIFYJS=./node_modules/.bin/uglifyjs
BROWSERIFY=./node_modules/browserify/bin/cmd.js

JS_CLIENT_FILES= lib/torque/*.js \
	lib/torque/renderer/*.js \
	lib/torque/gmaps/*.js \
	lib/torque/ol/*.js \
	lib/torque/leaflet/leaflet_tileloader_mixin.js \
	lib/torque/leaflet/canvas_layer.js \
	lib/torque/leaflet/torque.js

all: dist/torque.js dist/torque.full.js add-header

dist/torque.full.uncompressed.js: dist_folder dist/torque.uncompressed.js
	$(BROWSERIFY) lib/torque/index.js --standalone torque > dist/torque.full.uncompressed.js

dist/torque.full.js: dist_folder dist/torque.full.uncompressed.js
	$(UGLIFYJS) dist/torque.full.uncompressed.js > dist/torque.full.js

dist/torque.uncompressed.js: dist_folder $(JS_CLIENT_FILES)
	$(BROWSERIFY) lib/torque/index.js --no-bundle-external --standalone torque > dist/torque.uncompressed.js

dist/torque.js: dist_folder dist/torque.uncompressed.js
	$(UGLIFYJS) dist/torque.uncompressed.js > dist/torque.js

dist_folder:
	mkdir -p dist

test_dist_folder:
	mkdir -p test/dist

dist: dist_folder dist/torque.js

clean-results:
	-@rm test/results/*.png

add-header:
	node lib/header.js

prepare-test-suite: test_dist_folder
	$(BROWSERIFY) test/suite.js > test/dist/suite-bundle.js

test: prepare-test-suite
	@echo "***tests***"
	./node_modules/node-qunit-phantomjs/bin/node-qunit-phantomjs test/suite.html

test-acceptance: clean-results
	@echo "***acceptance***"
	./node_modules/.bin/qunit -c lib/torque/ -t `find test/acceptance/ -name "*.js"`

test-all: test test-acceptance

clean:
	rm -rf dist

.PHONY: clean dist_folder
