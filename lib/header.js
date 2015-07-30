var packageJSON = require("../package.json");
var fs = require("fs");

var headerString = "/**\n"
headerString += "Torque " + packageJSON.version + "\n";
headerString += packageJSON.description + "\n";
headerString += "https://github.com/cartodb/torque";
headerString += "\n**/\n\n\n";
fs.readFile("dist/torque.uncompressed.js", 'utf8', function(err, torque) {
	if(!err){	
		var torqueString = headerString + torque;
		fs.writeFile("dist/torque.uncompressed.js", headerString); 
	}
});

fs.readFile("dist/torque.full.uncompressed.js", 'utf8', function(err, torque) {
	if(!err){	
		var torqueString = headerString + torque;
		fs.writeFile("dist/torque.full.uncompressed.js", headerString); 
	}
});
