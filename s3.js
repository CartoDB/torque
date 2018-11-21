var s3 = require('s3');
var version = require('./package.json').version;
var secrets = require('./secrets');

var options = {
  s3Options: {
    accessKeyId: secrets.s3.accessKeyId,
    secretAccessKey: secrets.s3.secretAccessKey
  }
};

console.log('version', version);
console.log('secrets', secrets);

var params = {
  localDir: 'dist',
  s3Params: {
    Bucket: secrets.s3.bucket,
    Prefix: 'torque.js/' + version + '/',
    ACL: 'public-read'
  }
};

var client = s3.createClient(options);
var uploader = client.uploadDir(params);
uploader.on('error', function (err) {
  console.error('unable to sync', err.stack);
});
uploader.on('progress', function() {
  console.log("progress", uploader.progressAmount, uploader.progressTotal);
});
uploader.on('end', function() {
  console.log("done uploading");
});
