import os
import base64
import json
import sys
import argparse
 
class TorqueTile:
    def __init__(self, options):
        self.options = options
        if options['directory'] != '':
            if not os.path.exists(options['directory']):
                os.makedirs(options['directory'])
    def setData(self, data):
        self.data = data

    def setSql(table, agg, tcol, steps, res, x, y, zoom, webmercator):
        webmercator = webmercator if webmercator == None else 'the_geom_webmercator'
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
            "   floor(st_x(%s)*resinv)::int as x," % webmercator,
            "   floor(st_y(%s)*resinv)::int as y" % webmercator,
            "   , %s c" % agg,
            "   , floor((%s - start)/step)::int d" %tcol,
            "    FROM %s i, par p" % table,
            "    GROUP BY x, y, d"]);

    def setXYZ(self, x, y, z):
        self.z = str(z)
        self.zdir = z 
        if self.options['directory'] != '':
            self.zdir = self.options['directory'] + '/' + self.zdir
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



class PostGIS:
    def __init__(self, options):
        import psycopg2
        self.psycopg2 = psycopg2
        self.options = options

        conn_string = "host='%s' dbname='%s' user='%s'" % (self.options['pg_host'], self.options['pg_db'], self.options['pg_user'])
        if self.options['pg_pass']:
            conn_string += "password='%s'" % self.options['pg_pass']

        self.conn = self.psycopg2.connect(conn_string)
        self.cursor = self.conn.cursor()


    def _log(self, message):
        if self.options['verbose'] == True:
            print message
    def _error(self, error):
        print error
        sys.exit()
    def psql(self, sql):
        self.cursor.execute(sql)
        return self.cursor.fetchall()

    def run(self):
        table = self.options['t']
        zooms = self.options['z'].split('-')
        agg = self.options['a']
        steps = self.options['s']
        res = self.options['r']

        tcol = "date_part('epoch', %s)" % self.options['o'] if self.options['tt'] else self.options['o']

        zoom_c = int(zooms[0])
        zoom_e = int(zooms[-1])
        while zoom_c <= zoom_e:
            x = 0
            while x < 2**zoom_c:
                y = 0
                while y < 2**zoom_c:
                    z = str(zoom_c)
                    tile = TorqueTile({"directory": self.options['d']})
                    tile.setXYZ(x, y, z)
                    tile.setSql(table, agg, tcol, steps, res, 0, 0, z)
                    self._log("Fetching tile: x: %s, y: %s, z: %s" % (str(x), str(y), str(z)))
                    tile.setData(self.psql(sql))
                    tile.save()
                    self._log("Tile saved")
                    y += 1
                x += 1
            zoom_c += 1
        

class CartoDB:
    def __init__(self, options):
        try:
            import requests
        except ImportError:
            print 'The requests package is required: http://docs.python-requests.org/en/latest/user/install/#install'
            sys.exit()
        self.requests = requests
        self.requests.packages.urllib3.disable_warnings()
        # do stuff
        self.options = options
        self.api_url = "https://%s.cartodb.com/api/v2/sql" % (self.options['u'])
        self._log("CartoDB setup: %s" % self.api_url)
        if self.options['k']:
            self.api_url += "&api_key=%s" % (self.options['k'])
    def _log(self, message):
        if self.options['verbose'] == True:
            print message
    def _error(self, error):
        print error
        sys.exit()
    def sql_api(self, sql):
        # execute sql request over API
        params = {
            'api_key' : self.options["k"],
            'q'       : sql
        }
        r = self.requests.get(self.api_url, params=params)
        return r.json()

    def run(self):
        table = self.options['t']
        zooms = self.options['z'].split('-')
        agg = self.options['a']
        steps = self.options['s']
        res = self.options['r']

        tcol = "date_part('epoch', %s)" % self.options['o'] if self.options['tt'] else self.options['o']

        zoom_c = int(zooms[0])
        zoom_e = int(zooms[-1])
        while zoom_c <= zoom_e:
            x = 0
            while x < 2**zoom_c:
                y = 0
                while y < 2**zoom_c:
                    z = str(zoom_c)
                    tile = TorqueTile({"directory": self.options['d']})
                    tile.setXYZ(x, y, z)
                    tile.setSql(table, agg, tcol, steps, res, 0, 0, z)
                    # self._log("Fetching tile: x: %s, y: %s, z: %s" % (str(x), str(y), str(z)))
                    # tile.setData(self.sql_api(sql))
                    # tile.save()
                    # self._log("Tile saved")
                    y += 1
                x += 1
            zoom_c += 1
        
if __name__ == "__main__":
 
    SUPPORTED_METHODS = {
        'cartodb' : {
            "description": "Export torque tiles from CartoDB",
            "requirements": ["u", "t", "a", "o", "s", "r", "z", "d"],
            "example": "python torque.py cartodb -u {account} -t {table}  -a 'count(*)' -o {time-column} -s {steps} -r {resolution} -z 0-4  -d {directory}"
        },
        'postgis' : {
            "description": "Export torque tiles from PostGIS",
            "requirements": ["t", "a", "o", "s", "r", "z", "d", "pg_host", "pg_db", "pg_user"],
            "example": "python torque.py cartodb -t {table}  -a 'count(*)' -o {time-column} -s {steps} -r {resolution} -z 0-4  -d {directory} --pg_host {postgres-host} --pg_db {postgres-db --pg_user {postgres-user}"
        }
    }
    parser = argparse.ArgumentParser(description="CartoDB Python Utility")
 
    parser.add_argument('method', nargs="?", help='e.g. %s' % ','.join(SUPPORTED_METHODS.keys()))
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

    parser.add_argument('-v', '--verbose', dest='verbose', default=False, action="store_true", help='Verbose output if included')
 
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
                print "Arguement -%s is required\n\n%s\n\ndescription:\t%s\nrequired args:\t%s\nexample:\t%s" % (d,m,SUPPORTED_METHODS[m]['description'],SUPPORTED_METHODS[m]['requirements'],SUPPORTED_METHODS[m]['example'])
                sys.exit()
        
        if args.method.lower() == 'cartodb':
            cartodb = CartoDB(options)
            cartodb.run()

        if args.method.lower() == 'postgis':
            postgis = PostGIS(options)
            postgis.run()
