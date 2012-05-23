ogr2ogr -f "PostgreSQL" PG:"user=cartodb_user_2 dbname=cartodb_user_2_db" forma_120120424-24445-iu0g79.csv -nln forma_months
      53182,32275,16,
--Run once to merge Robins data where he has multiple events for the same polygon
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 16 as z FROM (
        SELECT x, y, period AS undate FROM forma_input WHERE z=16
    ) foo GROUP BY x,y
)  

## SEE DOWNSAMPLE
--Run loop for each zoom 16-7, 15-6 respectively
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 15 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=16
    ) foo GROUP BY x,y
)
        

--update the_geom for points   
SET statement_timeout TO 0; UPDATE forma_data SET the_geom = ST_Transform(ST_SetSRId(ST_Point( ((x*256) * (156543.03392804062 / (2^z)) - 20037508.342789244), -(((y)*256) * (156543.03392804062 / (2^z)) - 20037508.342789244)), 3857), 4326) WHERE the_geom IS NULL;

--create polygons
SET statement_timeout TO 0; DELETE FROM forma_zoom_polys; INSERT INTO forma_zoom_polys (the_geom,z,alerts) (SELECT st_multi(st_transform(ST_Envelope(ST_SetSRId(ST_Collect( ST_Point( ((x*256.0) * (156543.03392804062 / (2^z)) - 20037508.342789244), -(((y)*256.0) * (156543.03392804062 / (2^z)) - 20037508.342789244)),    ST_Point( (((x+1.0)*256.0) * (156543.03392804062 / (2^z)) - 20037508.342789244), -(((y-1.0)*256.0) * (156543.03392804062 / (2^z)) - 20037508.342789244))    ), 3857)),4326)) as the_geom,z,array_length(date_array,1) FROM forma_data);




--create arrays of distinct dates
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 15 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=16
    ) foo GROUP BY x,y,undate
)

--create arrays of all dates
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 13 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=14
    ) foo GROUP BY x,y
)

[zoom>=10][z=16]{marker-width:1;}
  [zoom=9][z=15]{marker-width:1;}