// =================
// profiler
// =================
//
// Counters
//   pendingJobs.inc();
//   pendingJobs.dec();
//
// Meters
//  A meter measures the rate of events over time
//  requests.mark();
//
// Histograms
//  responseSizes.update(response.getContent().length);
//
// Timers
//  private final Timer responses = metrics.timer(name(RequestHandler.class, "responses"));
// 
//  final Timer.Context context = responses.time();
    //try {
        //return "OK";
    //} finally {
        //context.stop();
    //}

// Health Checks
//
function Profiler() {
}
Profiler.times = {};
Profiler.new_time = function (type, time) {
    var t = Profiler.times[type] = Profiler.times[type] || {
        max:0,
        min:10000000,
        avg:0,
        total:0,
        count:0
    };

    t.max = Math.max(t.max, time);
    t.total += time;
    t.min = Math.min(t.min, time);
    ++t.count;
    t.avg = t.total / t.count;
};

Profiler.print_stats = function () {
    for (k in Profiler.times) {
        var t = Profiler.times[k];
        console.log(" === " + k + " === ");
        console.log(" max: " + t.max);
        console.log(" min: " + t.min);
        console.log(" avg: " + t.avg);
        console.log(" total: " + t.total);
    }
};

Profiler.get = function (type) {
    return {
        t0:null,
        start:function () {
            this.t0 = new Date().getTime();
        },
        end:function () {
            if (this.t0 !== null) {
                Profiler.new_time(type, this.time = new Date().getTime() - this.t0);
                this.t0 = null;
            }
        }
    };
};
