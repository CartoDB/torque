## How spatial aggregation works

When the Torque library renders points, it does not render exactly the same points you have in the database; instead it aggregates the points in clusters in order to speed up rendering and data transfer.

So imagine you have this CartoCSS:

```css
Map {
  -torque-aggregation-function:"count(cartodb_id)";
  -torque-resolution: 2;
}
```

This means that for the current zoom level, Torque will fetch points in clusters of 2x2 pixels. Every cluster has a value calculated by the function defined after ``-torque-aggregation-function``. In the case above, the value will be the number of points inside that cluster. That value can be accessed from CartoCSS using the variable `value`.

Every cluster is renderer as a point.

Given that you can do:

```css
#layer {
[value > 1] { marker-fill: #000; }
[value > 4] { marker-fill: #400; }
[value > 16] { marker-fill: #800; }
[value > 32] { marker-fill: #F00; }
}
```

This would render the point with different colors depending on the number of points inside it.

## Can I use strings with Torque?

In general you can **not** do:
```css
[column = 'mytext'] { marker-fill: red; }
```

There are two reasons for this limitation:
  - cluster does not contain values for all the columns, you can only use ``value`` variable
  - you would need to use an aggregation function for strings

So how could I use strings column with Torque?

Imagine you have a string column (`team`) with two values, "team A" and "team B", and you want to color "team A" points to be red and "team B" to be blue, you could add a new column on the fly:

```javascript
torqueLayer.setSQL("select *, (CASE WHEN team='team A' THEN 1 ELSE 2 END) as team_n from table");
```

and then apply this CartoCSS:

```css
Map {
  ...
  -torque-aggregation-function: "round(avg(team_n))";
  ...
}

#layer {
  ...
  marker-fill: #FF0000;
  // avg of 1 and 2
  [value > 1.5] { marker-fill: #0000FF; }
  ...
}
```      

**Tip:** CartoCSS is one the tools of the CARTO platform. You can learn more about the different [components of CARTO platform]({{site.fundamental_docs}}/components/), or directly dig into [CartoCSS too]({{site.tools_cartocss}}/) details.

