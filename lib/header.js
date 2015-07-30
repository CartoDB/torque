// Adds version header to distributions

var fs = require('fs');

var packageJSON = require('../package.json');
var headerString = ['/**',
									 	'Torque {{version}}',
									 	'{{description}}',
									 	'{{url}}',
									 	'**/\n\n',
									 	'{{lib}}'].join('\n');
headerString = headerString.replace("{{version}}", packageJSON.version)
							             .replace("{{description}}", packageJSON.description)
							             .replace("{{url}}", "https://github.com/cartodb/torque");

['torque.uncompressed.js','torque.full.uncompressed.js'].forEach(function(v){
	fs.readFile('dist/' + v, 'utf8', function(err, torque) {
		if(!err){	
			var torqueString = headerString.replace("{{lib}}", torque);
			fs.writeFile('dist/' + v, torqueString); 
		}
	});
});
