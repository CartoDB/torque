
UGLIFYJS=./node_modules/.bin/uglifyjs

JS_CLIENT_FILES= lib/torque/*.js \
	lib/torque/renderer/*.js \
	lib/torque/gmaps/*.js \
	lib/torque/leaflet/*.js 

dist/torque.uncompressed.js: dist_folder $(JS_CLIENT_FILES)
	cat $(JS_CLIENT_FILES) > dist/torque.uncompressed.js

dist/torque.js: dist_folder dist/torque.uncompressed.js
	$(UGLIFYJS) dist/torque.uncompressed.js > dist/torque.js

dist_folder:
	mkdir -p dist

dist: dist_folder dist/torque.js

all: dist/torque.js
clean: 
	rm -rf dist

.PHONY: clean dist_folder

