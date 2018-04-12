## Torque CartoCSS

CartoCSS is one the tools of the CARTO platform. You can learn more about the different [components of CARTO platform]({{site.fundamental_docs}}/components/), or directly dig into [CartoCSS too]({{site.tools_cartocss}}/) details.

`-torque-clear-color`
Color used to clear canvas on each frame.

`-torque-frame-count`
Number of animation steps/frames used in the animation. If the data contains a fewer number of total frames, the lesser value will be used.

`-torque-resolution`
Spatial resolution in pixels. A resolution of 1 means no spatial aggregation of the data. Any other resolution of N results in spatial aggregation into cells of NxN pixels. The value N must be power of 2.

`-torque-animation-duration`
Animation duration in seconds.

`-torque-aggregation-function`
A function used to calculate a value from the aggregate data for each cell. See [-torque-resolution](#-torque-resolution).

`-torque-time-attribute`
The table column that contains the time information used create the animation.

`-torque-data-aggregation`
A linear animation will discard previous values while a cumulative animation will accumulate them until it restarts.
