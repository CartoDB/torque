## Data Methods

Method | Options | Returns | Description
---|---|---|---
`setSQL(sql statement)` | `SQL string` | `this` | Change the SQL on the data table (not available with named maps)
`error(callback)` | `callback function with a list of errors as argument` | `this` | specifies a callback function to run if there are query errors


**Example:**
```js
// SQL Example to limit the data used in the Torque map.
torqueLayer.setSQL("SELECT * FROM table LIMIT 100");
