import sys

tile_sql = """
WITH par AS (
    WITH innerpar AS (
        SELECT 1.0/(CDB_XYZ_Resolution({zoom})*{resolution}) as resinv
    ),
    bounds AS (
        SELECT min({column_conv}) as start, (max({column_conv}) - min({column_conv}) )/{steps} step 
        FROM ({_sql}) _i
    )
    SELECT CDB_XYZ_Resolution({zoom})*{resolution} as res, innerpar.resinv as resinv, start, step FROM innerpar, bounds
)
select
   floor(st_x(i.{gcol})*resinv) as xx,
   floor(st_y(i.{gcol})*resinv) as yy
   , {countby} c
   , floor(({column_conv} - start)/step) d
    FROM ({_sql}) i, par p
    GROUP BY xx, yy, d

"""

if len(sys.argv) != 6:
    print "python torque_query.py zoom resolution time_column steps table"
    print "example: "
    print """python torque_query.py 14 1 "date_part('epoch', date)" 512 ships"""

    sys.exit()

zoom = int(sys.argv[1])
table = sys.argv[5]
for x in xrange(zoom + 1):
    zoom_name = '%s_torque_zoom_%d' % (table, x)
    mat = "DROP MATERIALIZED VIEW IF EXISTS %s ;\n" % zoom_name
    mat += "create materialized view %s as " % zoom_name

    mat += tile_sql.format(
        zoom=x,
        resolution=int(sys.argv[2]),
        gcol='the_geom_webmercator',
        column_conv=sys.argv[3],
        steps=int(sys.argv[4]),
        _sql='select * from %s' % table,
        countby='count(cartodb_id)'
    )

    mat += ";"

    print mat
