onmessage = function(e){
	var cutoff = e.data[1];
	var subset = e.data[0].slice(b,f);
	for (var i = subset.length-4, alpha; i>=0; i-=4){
        alpha = subset[i+3] * 4; // get gradient color from opacity value
        if (alpha>0) {
            this.heatmapLayer[i] = grad[alpha]; // R
            this.heatmapLayer[i + 1] = grad[alpha + 1]; // G
            this.heatmapLayer[i + 2] = grad[alpha + 2]; // B
            this.heatmapLayer[i + 3] = alpha; 	// A
        }
	}
}