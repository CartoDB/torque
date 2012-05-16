var MAPDIG = {};

MAPDIG.create = function(carto_user, table_name, ignore, default_width) {
    var me = {
        generated_sql: 'SELECT * FROM ' + table_name,
        SQL: 'SELECT * FROM ' + table_name,
        table: table_name,
        carto_user: carto_user,
        ignore: ['cartodb_id', 'the_geom', 'the_geom_webmercator', 'updated_at', 'created_at'].concat(ignore),
        numbers: {},
        strings: {},
        origin_numbers: {},
        default_width: default_width
    };

    me.toSQL = function(){
        var sql = this.SQL;
        var filter_sql = [];

        _.each(this.numbers, function(val,key){
            if (this.origin_numbers[key] != val){
                var root = key.split(' ')[0]
                var cap  = key.split(' ')[1]
                if (cap == 'min'){
                    filter_sql.push(root + '>=' + val);
                } else {
                    filter_sql.push(root + '<=' + val)
                }
            }
        }, this);

        _.each(this.strings, function(val,key){
            if (val != '*'){
                filter_sql.push(key + ' LIKE \'%25' + val + '%25\'');
            }
        }, this);

        return ((filter_sql.length < 1) ? sql : sql + ' WHERE ' + filter_sql.join(' AND '));
    };

    me.init = function(cartodb_layer){
        var c, n1, s1, f1, tmp_dat; // holders for event handlers and reflected columns
        var that = this;
        that.layer = cartodb_layer;
        dat.GUI.DEFAULT_WIDTH = that.default_width;
        that.gui   = new dat.GUI();

        // Direct SQL input
        c = that.gui.add(that, 'generated_sql').name('Map SQL');
        c.onFinishChange(function(value) { that.executeSQL(value); });

        // Attempt to reflect table structure and attach controls and events for all columns found
        // Currently does this long hand as cannot access schema. dumb, but works
        $.getJSON('http://'+that.carto_user+'.cartodb.com/api/v2/sql/?q=select%20*%20from%20' + that.table +'%20limit%201', function(data){

            // grab the top value in each col, strip ignores
            var cols = [];
            _.each(data.rows[0],function(val,key){
                if (!_.include(that.ignore, key)){
                    cols.push('max("'+key+'") as ' + key);
                }
            });

            // sample a value from each column to determine GUI element type
            $.getJSON('http://'+that.carto_user+'.cartodb.com/api/v2/sql/?q=select%20'+cols.join(',') +'%20from%20' + that.table +'%20limit%201', function(data){
                n1 = that.gui.addFolder('Numeric filter');
                s1 = that.gui.addFolder('Text filter');
                _.each(data.rows[0], function(val,key){
                    if(_.isNumber(val)){
                        $.getJSON('http://'+that.carto_user+'.cartodb.com/api/v2/sql/?q=select min("'+key+'"), max("'+key+'") from ' + that.table, function(data){
                            if (data.rows[0].max > data.rows[0].min){
                                //f1 = n1.addFolder(key);

                                that.numbers[key+' min'] = data.rows[0].min;
                                that.numbers[key+' max'] = data.rows[0].max;
                                that.origin_numbers[key+' min'] = data.rows[0].min;
                                that.origin_numbers[key+' max'] = data.rows[0].max;

                                c = n1.add(that.numbers, key+' min', data.rows[0].min, data.rows[0].max);
                                c.onFinishChange(function(value) { that.renderSQL(); });
                                c = n1.add(that.numbers, key+' max', data.rows[0].min, data.rows[0].max);
                                c.onFinishChange(function(value) { that.renderSQL(); });
                            }
                        });
                    }

                    // test if it's massive - if so, text box, else dropdown.
                    if(_.isString(val)){
                        $.getJSON('http://'+that.carto_user+'.cartodb.com/api/v2/sql/?q=select count(distinct("'+key+'")) from ' + that.table, function(data){
                            if (data.rows[0].count <= 1000 && data.rows[0].count > 0){
                                $.getJSON('http://'+that.carto_user+'.cartodb.com/api/v2/sql/?q=select distinct("'+key+'") as ele from ' + that.table + ' ORDER BY ELE ASC', function(data){
                                    tmp_dat = _.map(data.rows, function(r){ return r.ele; });
                                    tmp_dat.unshift('*');
                                    that.strings[key] = '*';
                                    c = s1.add(that.strings, key, tmp_dat );
                                    c.onFinishChange(function(value) { that.renderSQL(); });
                                });
                            } else {
                                that.strings[key] = '*';
                                c = s1.add(that.strings,key);
                                c.onFinishChange(function(value) { that.renderSQL(); });
                            }
                        });
                    }
                });
            });
        });

        // disabled as buggy
        //this.gui.remember(this);
    };

    me.executeSQL = function(sql){
        this.layer.update(sql);
    };

    me.renderSQL = function(){
        this.generated_sql = this.toSQL();
        for (var i in this.gui.__controllers) {
            this.gui.__controllers[i].updateDisplay();
        }
        this.layer.update(this.generated_sql);
    };

    return me;
};


