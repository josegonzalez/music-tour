(function() {
  //ben's js
  var numEvents = 7;
  var url = "http://api.seatgeek.com/2/events?performers.slug=jason-aldean&per_page=" + numEvents + "&format=json&callback=fireEvent";
  $.ajax({
    url: url,
    success: function(data) {
      var events = data.events;
      var firstDate = Date.parse(events[0].datetime_local);
      var timespan = Date.parse(events.last().datetime_local) - firstDate; //optionally use 'new Date()' to start timespan from current date

      for (var i = 0; i < events.length; i++) {
        events[i].date_shift_from_zero = (Date.parse(events[i].datetime_local) - firstDate)/timespan;
        var bufferWidth = 100;
        var pixelShift = ($("div#timeline").width() - bufferWidth) * events[i].date_shift_from_zero - 16 + (0.5 * bufferWidth);

        var classes = "timeline-points";
        if(i==0) {classes = classes + " active";}
        var html = "<div class='" + classes + "' style='margin-left: " + Math.round(pixelShift) + "px' data-eventid='" + events[i].id + "'>" + (i + 1) + "</div>";
        $("div#timeline-points").append(html);
      }
    },
    dataType: 'jsonp'}
  );

  Array.prototype.last = function() {return this[this.length-1];}

  //jose's js
  var width = 790,
      height = 500;

  var radius = d3.scale.sqrt()
      .domain([0, 1e6])
      .range([0, 10]);

  var unselected_radius = radius(2500000);

  var projection = albersUsa();

  var path = d3.geo.path()
      .projection(projection)
      .pointRadius(1.5);

  var svg = d3.select(".tour-map").append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("width", width)
      .attr("height", height);

  svg.append("filter")
      .attr("id", "glow")
    .append("feGaussianBlur")
      .attr("stdDeviation", 5);

  queue()
      .defer(d3.json, "/us.json")
      .defer(d3.jsonp, "http://api.seatgeek.com/2/events?performers.slug=jason-aldean&per_page=" + numEvents + "&callback={callback}")
      .await(ready);

  function ready(error, us, events) {
    // translucent outer glow
    svg.append("path")
        .datum(topojson.object(us, us.objects.land))
        .attr("d", path)
        .attr("class", "land-glow");

    // states
    topojson.object(us, us.objects.states).geometries.forEach(function(o, index) {
      svg.append("path")
          .datum(o)
          .attr("d", path);
    });

    // collect the events
    events.events.forEach(function(evt, index) {
      var il = (index + 1).toString().length,
          location = evt.venue.location,
          coords = _.extend({}, [location.lon, location.lat]);

      svg.append("path")
        .datum({type: "MultiPoint", coordinates: [coords]})
        .attr("class", "points event-" + evt.id)
        .attr("data-eventid", evt.id)
        .attr("d", path.pointRadius(function(d) { return unselected_radius; }));

       svg.append("text")
        .attr("class", "place-label event-" + evt.id)
        .attr("data-eventid", evt.id)
        .attr("transform", function(d) { return "translate(" + projection(coords) + ")"; })
        .attr("x", function(d) { return coords[0] > -1 ? (il > 1 ? 12 : 6) : (il > 1 ? -12 : -6); })
        .attr("y", function(d) { return coords[1] > -1 ? 1 : -1; })
        .attr("dy", ".35em")
        .text(function(d) { return index + 1; });
    });

    //on mouseenter of timeline point, activate the timeline point + corresponding map point
    $("div.timeline-points").mouseenter(function() {
      $("div.timeline-points").removeClass("active");
      $(this).addClass("active");
      
      $("svg path.points").each(function() {
        $(this).attr("class", $(this).attr("class").replace(" active",""));
      });
      var thisMapPoint = $("svg path.points.event-" + $(this).attr("data-eventid"));
      thisMapPoint.attr("class", thisMapPoint.attr("class") + " active");
    });

    //on mouseenter of map point label, activate the map point + corresponding timeline point
    $("svg text.place-label, svg path.points").hover(function() {
      $("svg path.points, div.timeline-points").each(function() {
        $(this).attr("class", $(this).attr("class").replace(" active",""));
      });
      var thisMapPoint = $(".points.event-" + $(this).attr("data-eventid"));
      thisMapPoint.attr("class", thisMapPoint.attr("class") + " active");
      var thisTimelinePoint = $("div.timeline-points[data-eventid='" + $(this).attr("data-eventid") + "']");
      thisTimelinePoint.attr("class", thisTimelinePoint.attr("class") + " active");
    });
    
  }

})();
