// Pseudocode for Splunk/Torque
// Torque.js calls getTileData() for each visible tile on the screen
// getTileData will build and execute an API call,
// transform the results into a valid torque tile

function getTileData() {
  //3 things we need to build a splunk query for a given tile:
  bounds = boundsFromTile();
  
  binspan = (bounds.maxLon-bounds.minLon)/numberOfGeobins;

  timespan = totalTimeRange/numberOfTimebins;

  query = assembleQuery();
  //search source="earthquake2.csv" lat>-85.05112877980659 lat<85.0511287798066 lon>-180 lon<180| bucket _time span=1010384s | geostats count by _time  maxzoomlevel=0 globallimit=128 binspanlat=1.40625 binspanlong=2.8125

  ajaxPOST(query, function(geobins){ //gets raw data from splunk
    
    torqueTile = parseData(geobins); //iterates over each geobin, converts lat/lon centroid to Tile XY, converts UNIX timestamp into step number, outputs a valid torque tile as would be returned by cartoDB

    processTile(torqueTile); //processTile animates the tile data with torque & canvas

  });

}