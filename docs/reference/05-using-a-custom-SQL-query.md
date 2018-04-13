## Using a custom SQL query
Name | Description
--- | ---
query | A string object, the SQL query to be performed to fetch the data. Default value is ```null```.<br/><br/>You must use this param or table, but not at the same time
**Tip:** For a Torque category layer that is created dynamically with `cartodb.createLayer`, the SQL query must explicitly include how to build the torque_category column. You must include both the `sql` and `table_name` parameters. See this [createLayer with torque category layer](https://gist.github.com/danicarrion/dcaf6f00a71aa55134b4) example.
