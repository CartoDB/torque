onmessage = function(e){
	var index = e.data[1];
	var pointList = e.data[0];
    var n = e.data[2]
    var cs = Math.round(pointList.length/4/n);
    var si = cs * index * 4;
    var ei = (si + cs) * 4;
    var subset = pointList.subarray(si,ei);
	for (var i = subset.length-4, alpha; i>=0; i-=4){
        alpha = subset[i+3] * 4; // get gradient color from opacity value
        if (alpha>0) {
            subset[i] = this.gradientData[alpha]; // R
            subset[i + 1] = this.gradientData[alpha + 1]; // G
            subset[i + 2] = this.gradientData[alpha + 2]; // B
            subset[i + 3] = alpha; 	// A
        }
	}
    postMessage([index, subset]);
}