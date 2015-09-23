import os
import base64
import json
import sys
import argparse


class CartoDBProvider:
    def __init__(self, options):
        import requests
        requests.packages.urllib3.disable_warnings()
        self.api_url = "https://%s.cartodb.com/api/v2/sql" % options['u']
        if options['k']:
            self.api_url += "&api_key=%s" % options['k']
        self.api_key = options['k']
        self.requests = requests

    def request(self, sql):
        # execute sql request over CartoDB API
        params = {
            'api_key': self.api_key,
            'q': sql
        }
        r = self.requests.get(self.api_url, params=params)
        # print r.text
        return r.json()['rows']


class PostGISProvider:
    def __init__(self, options):
        import psycopg2
        conn_string = "host='%s' dbname='%s' user='%s'" % (options['pg_host'], options['pg_db'], options['pg_user'])
        if options['pg_pass']:
            conn_string += "password='%s'" % self.options['pg_pass']
        conn = psycopg2.connect(conn_string)
        self.cursor = conn.cursor()

    def request(self, sql):
        # execute sql request over PostgreSQL connection
        self.cursor.execute(sql)
        return self.cursor.fetchall()

tile_size = 256
buffer_size = 0
def cdb_XYZ_Resolution(z):
    full_resolution = 40075017 / tile_size
    return full_resolution / 2**z

def cdb_XYZ_Extent(x, y, z, res):
    initial_resolution = cdb_XYZ_Resolution(0);
    origin_shift = (initial_resolution * tile_size) / 2.0;

    pixres = initial_resolution / 2**z;
    tile_geo_size = tile_size * pixres;

    buffer = buffer_size / 2;

    xmin = -origin_shift + x*tile_geo_size;
    xmax = -origin_shift + (x+1)*tile_geo_size;

    # // tile coordinate system is y-reversed so ymin is the top of the tile
    ymin = origin_shift - y*tile_geo_size;
    ymax = origin_shift - (y+1)*tile_geo_size;
    return {
        'xmin': xmin,
        'ymin': ymin,
        'xmax': xmax,
        'ymax': ymax,
        'b_xmin': xmin - (pixres * buffer),
        'b_ymin': ymin + (pixres * buffer),
        'b_xmax': xmax + (pixres * buffer),
        'b_ymax': ymax - (pixres * buffer),
        'b_size': buffer / res
    }


class TorqueTile:
    def __init__(self, provider, directory):
        self.provider = provider
        self.directory = directory
        if self.directory != '':
            if not os.path.exists(self.directory):
                os.makedirs(self.directory)

    def fetchData(self):
        self.data = self.provider.request(self.sql)

    def setSql(self, table, agg, tcol, steps, res, x, y, zoom, webmercator=None):
        webmercator = webmercator if webmercator is not None else 'the_geom_webmercator'

        self.sql = ' '.join(["WITH par AS (",
             "    WITH innerpar AS (",
             "        SELECT 1.0/(CDB_XYZ_Resolution(%s)*%s) as resinv" % (zoom, res),
             "    ),",
             "    bounds AS (",
             "        SELECT min(%s) as start, " % tcol,
             "              (max(%s) - min(%s) )/%s step " % (tcol, tcol, steps),
             "        FROM %s _i" % table,
             "    )",
             "    SELECT CDB_XYZ_Resolution(%s)*%s as res, " % (zoom, res),
             "           innerpar.resinv as resinv, start, step FROM innerpar, bounds",
             ")",
             "select",
             "   floor(st_x(%s)*resinv)::int as x__uint8," % webmercator,
             "   floor(st_y(%s)*resinv)::int as y__uint8" % webmercator,
             "   , %s vals__uint8" % agg,
             "   , floor((%s - start)/step)::int dates__uint16" % tcol,
             "    FROM %s i, par p" % table,
             "    GROUP BY x__uint8, y__uint8, dates__uint16"])


        extend = cdb_XYZ_Extent(x, y, zoom, res)
        self.sql = """
            WITH par AS (
                WITH innerpar AS (
                    SELECT
                        1.0/(({xyz_resolution})*{resolution}) AS resinv,
                        ST_MakeEnvelope({b_xmin}, {b_ymin}, {b_xmax}, {b_ymax}, {srid}) AS b_ext,
                        ST_MakeEnvelope({xmin}, {ymin}, {xmax}, {ymax}, {srid}) AS ext
                    ),
                _start AS (
                    select min({column_conv}) as min from {table}
                )
                    SELECT
                        ({xyz_resolution})*{resolution} AS res,
                        innerpar.resinv AS resinv,
                        innerpar.b_ext AS b_ext,
                        st_xmin(innerpar.ext) AS xmin,
                        st_ymin(innerpar.ext) AS ymin,
                        round((st_xmax(innerpar.ext) - st_xmin(innerpar.ext))*innerpar.resinv) - 1 AS maxx,
                        round((st_ymax(innerpar.ext) - st_ymin(innerpar.ext))*innerpar.resinv) - 1 AS maxy,
                        _start.min as start
                    FROM innerpar, _start
                )
                SELECT xx x__uint8,
                       yy y__uint8,
                       array_agg(c) vals__uint8,
                       array_agg(d) dates__uint16
                FROM (
                    SELECT
                        GREATEST(0 - {b_size}, LEAST(p.maxx + {b_size}, round((st_x(i.{gcol}) - p.xmin)*resinv))) AS xx,
                        GREATEST(0 - {b_size}, LEAST(p.maxy + {b_size}, round((st_y(i.{gcol}) - p.ymin)*resinv))) AS yy,
                        {countby} c,
                        floor(({column_conv} - start)/{step}) d
                    FROM ({_SQL}) i, par p
                    WHERE i.{gcol} && p.b_ext
                    GROUP BY xx, yy, d
                ) cte, par
                GROUP BY x__uint8, y__uint8;
        """.format(
            xyz_resolution=cdb_XYZ_Resolution(zoom),
            resolution=res,
            b_xmin=extend['b_xmin'],
            b_ymin=extend['b_ymin'],
            b_xmax=extend['b_xmax'],
            b_ymax=extend['b_ymax'],
            srid=3857,
            xmin=extend['xmin'],
            ymin=extend['ymin'],
            xmax=extend['xmax'],
            ymax=extend['ymax'],
            b_size=extend['b_size'],
            countby=agg,
            column_conv=tcol,
            step=steps,
            _SQL='select * from %s' % table,
            table=table,
            gcol=webmercator
        )

        print self.sql



    def setXYZ(self, x, y, z):
        self.z = str(z)
        self.zdir = z
        if self.directory != '':
            self.zdir = self.directory + '/' + self.zdir
        if self.zdir != '':
            if not os.path.exists(self.zdir):
                os.makedirs(self.zdir)
        self.x = str(x)
        self.xdir = self.zdir + '/' + self.x
        if not os.path.exists(self.xdir):
            os.makedirs(self.xdir)
        self.y = str(y)

    def getFilename(self):
        return self.xdir + '/' + self.y + '.json.torque'

    def save(self):
        with open(self.getFilename(), 'w') as outfile:
            json.dump(self.data, outfile)
        return True


class Torque:
    def __init__(self, options):
        if args.method.lower() == 'cartodb':
            self.provider = CartoDBProvider(options)

        if args.method.lower() == 'postgis':
            self.provider = PostGISProvider(options)
        self.options = options

    def fetchTiles(self):
        zooms = self.options['z'].split('-')
        zoom_c = int(zooms[0])
        zoom_e = int(zooms[-1])
        time_value = "date_part('epoch', %s)" % self.options['o'] if self.options['tt'] else self.options['o']
        time_value = self.options['o']
        while zoom_c <= zoom_e:
            x = 0
            while x < 2**zoom_c:
                y = 0
                while y < 2**zoom_c:
                    z = str(zoom_c)
                    tile = TorqueTile(self.provider, self.options['d'])
                    tile.setXYZ(x, y, z)
                    tile.setSql(
                        self.options['t'],  # table
                        self.options['a'],  # aggregation
                        time_value,
                        int(self.options['s']),  # steps
                        int(self.options['r']),  # resolution
                        int(x), int(y), int(z),  # x, y, zoom
                        self.options['wm']  # webmercator
                    )
                    tile.fetchData()
                    tile.save()
                    y += 1
                x += 1
            zoom_c += 1

if __name__ == "__main__":

    SUPPORTED_METHODS = {
        'cartodb': {
            "description": "Export torque tiles from CartoDB",
            "requirements": ["u", "t", "a", "o", "s", "r", "z", "d"],
            "example": "python torque.py cartodb -u {account} -t {table} \
            -a 'count(*)' -o {time-column} -s {steps} -r {resolution} \
            -z 0-4  -d {directory}"
        },
        'postgis': {
            "description": "Export torque tiles from PostGIS",
            "requirements": ["t", "a", "o", "s", "r", "z",
                             "d", "pg_host", "pg_db", "pg_user"],
            "example": "python torque.py cartodb -t {table}  -a 'count(*)' -o {time-column} \
            -s {steps} -r {resolution} -z 0-4  -d {directory} \
            --pg_host {postgres-host} --pg_db {postgres-db \
            --pg_user {postgres-user}"
        }
    }
    parser = argparse.ArgumentParser(description="CartoDB Python Utility")

    parser.add_argument('method', nargs="?",
                        help='e.g. %s' % ','.join(SUPPORTED_METHODS.keys()))
    parser.add_argument('-u', '--user', dest='u', type=str)
    parser.add_argument('-t', '--table', dest='t', type=str)
    parser.add_argument('-a', '--aggregation', dest='a', type=str)
    parser.add_argument('-o', '--ordering', dest='o', type=str)
    parser.add_argument('-s', '--steps', dest='s', type=str)
    parser.add_argument('-d', '--dir', dest='d', default='', type=str)
    parser.add_argument('-z', '--zoom', dest='z', type=str)
    parser.add_argument('-q', '--is_time', dest='tt', default=True, type=bool)
    parser.add_argument('-r', '--resolution', dest='r', type=str)
    parser.add_argument('-k', '--api_key', dest='k', type=str)
    parser.add_argument('-w', '--webmercator', dest='wm', type=str)
    parser.add_argument('--pg_host', dest='pg_host', type=str)
    parser.add_argument('--pg_db', dest='pg_db', type=str)
    parser.add_argument('--pg_user', dest='pg_user', type=str)
    parser.add_argument('--pg_pass', dest='pg_pass', type=str)

    parser.add_argument('-v', '--verbose', dest='verbose',
                        default=False, help='Verbose output if included')

    args = parser.parse_args()
    options = vars(args)
    print options

    def success(message):
        print 'SUCCESS', message

    def failure(message):
        print 'FAILURE', message
    m = args.method.lower()

    if m in SUPPORTED_METHODS.keys():
        for d in SUPPORTED_METHODS[m]["requirements"]:
            if options[d] is None:
                print "Arguement -%s is required\n\n%s\n\ndescription:\t%s\n \
                       required args:\t%s\nexample:\t%s" % (
                        d, m, SUPPORTED_METHODS[m]['description'],
                        SUPPORTED_METHODS[m]['requirements'],
                        SUPPORTED_METHODS[m]['example'])
                sys.exit()
        job = Torque(options)
        job.fetchTiles()
