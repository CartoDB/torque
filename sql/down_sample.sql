
--Run loop for each zoom 16-7, 15-6 respectively
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 15 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=16
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 14 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=15
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 13 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=14
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 12 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=13
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 11 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=12
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 10 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=11
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 9 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=10
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 8 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=9
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 7 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=8
    ) foo GROUP BY x,y
);
INSERT INTO forma_data (x,y,date_array,z) (
    SELECT x, y, array_agg(undate) as date_array, 6 as z FROM (
        SELECT floor(x/2) as x, floor(y/2) as y, unnest(date_array) AS undate FROM forma_data WHERE z=7
    ) foo GROUP BY x,y
);
        