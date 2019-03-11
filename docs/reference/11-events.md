## Events

Events in Torque follow the format:

```js
torqueLayer.on('event-type', function([callback_obj]) {
  // do something
});
```

Events | Callback Object | Description
---|---|---
`change:steps` | current step | When a map changes steps, this event is triggered
`change:time` | current time, step number | When a map changes time, this event is triggered
`play` | none | Triggered when the Torque layer is played
`pause` | none | Triggered when the Torque layer is paused
`stop` | none | Triggered when the Torque layer is stopped
`load` | none | Triggered when the Torque layer is loaded

**Example:**
```js
// An event example to print the current step to the console log.

torqueLayer.on('change:steps', function(step) {
  // do something with step
  console.log('Current step is ' + step);
});
```
