var mapnik = require('@carto/mapnik');

function compare(buffer, fixtureRelPath) {
    save(__dirname + '/../results/' + fixtureRelPath, buffer);

    var img = new mapnik.Image.fromBytesSync(buffer);
    var reference = new mapnik.Image.openSync(__dirname + '/../fixtures/image/' + fixtureRelPath);
    return img.compare(reference) / (reference.width() * reference.height());
}

function save(path, buffer) {
    var img = new mapnik.Image.fromBytesSync(buffer);
    img.save(path);
}

module.exports = {
    compare: compare,
    save: save
};
