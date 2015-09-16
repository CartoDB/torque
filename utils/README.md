## torque.py

### Description

The torque.py script lets you export [Torque tilecubes](https://github.com/CartoDB/tilecubes) to static files for storage and use. This script can be useful for storage and backup of your Torque visualizations as well as using the Torque library offline or where the CartoDB backend isn't needed.

### Usage

Below are a list of parameters shared for both datasources (CartoDB and Postgis):

| Option   | Short | type         | Description  |
|-----------|:-----------|:-----------|:----------|
| --aggregation | -a  | string     | SQL aggregation function to calculate each pixel **value**  | 
| --ordering  | -o | string     | The name of the column (either number or date) that orders your data | 
| --is_time  | -q | string     | Default True, set to false if your ordering column is not temporal | 
| --steps  | -s | integer     | The number of ordered steps in your tile cubes | 
| --resolution  | -r | integer     | The width and height dimensions of each pixel | 
| --zoom  | -z | string     | The zoom extents to generate tiles | 
| --dir  | -d | string     | Optional. The directory to store your output | 
| --verbose  | -v | none     | Optional. Verbose log output | 


#### CartoDB data source

##### Example

```bash
python torque.py cartodb -u andrew -t all_week  -a 'count(*)' -o time 
-s 2 -r 4 -z 0-1  -d tiles -v
```

##### Options


| Option   | Short | type         | Description |
|-----------|:-----------|:-----------|:----------|
| --user  | -u | string     | Name of the account where the tiles are generated  | 
| --table | -t | string     | Name of the table where the Torque data is hosted  | 
| --api_key  | -k | string     | Optional. Your account api_key if the table is set to **private** | 

#### PostGIS data source

#####Example

```bash
python torque.py postgis -u andrew -t all_week  -a 'count(*)' -o time 
-s 2 -r 4 -z 0-1 -w "ST_Transform(the_geom, 3857)" --pg_host localhost 
--pg_db postgresql --pg_user postgresql -d tiles
```

| Option   | Short | type         | Description |
|-----------|:-----------|:-----------|:----------|
| --pg_host  |  | string     | Hostname of your PostgreSQL database  | 
| --pg_db  |  | string     | PostgreSQL database name | 
| --pg_user  |  | string     | PostgreSQL username  | 
| --webmercator  | -w | string     | Either a column containing your webmercator geometry or a quoted SQL statement to transform a geometry on the fly to webmercator.  | 


### Storage

A each Torque tile is a small JSON document that matches the dimensions of a map tile in webmercator. Just like web tiles, Torque tiles are stored in a nested folder structure that follows the organization ```{zoom level}/{x coordinate}/{y coordinate}.json.torque```.

