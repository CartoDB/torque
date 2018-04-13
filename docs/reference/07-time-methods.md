## Time Methods

Method | Options | Returns | Description |
---|---|---|---|
`setStep(step)` | `time numeric` | `this` | the value must be between 0 and the total number of `steps` in the animation
`play()` | | `this` | starts the animation
`stop()` | | `this` | stops the animation and set time to step 0
`pause()` | | `this` | stops the animation but keep the current time (play enables the animation again)
`toggle()` | | `this` | toggles (pause/play) the animation
`getStep()` | | current animation step (integer) | gets the current animation step. A step is considered an animation frame
`getTime()` | | current animation time (Date) | gets the real animation time
`isRunning()` | | `true`/`false` | describes whether the Torque layer is playing or is stopped

**Note:** Torque.js interprets the beginning and ending date/time from your "Time Column" as one block, then divides that up into [Steps](https://carto.com/docs/carto-engine/cartocss/properties-for-torque/#torque-frame-count-number), depending on the number you set. It does not necessarily draw one frame for each row.
