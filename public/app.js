(function() {
  //ben's js
  var numEvents = 5;
  var url = "http://api.seatgeek.com/2/events?performers.slug=jason-aldean&per_page=" + numEvents + "&format=json&callback=fireEvent";
  $.ajax({
    url: url,
    //data: '',
    success: function(data) {
      var events = data.events;
      var firstDate = Date.parse(events[0].datetime_local);
      var timespan = Date.parse(events.last().datetime_local) - firstDate; //optionally use 'new Date()' to start timespan from current date
      
      for (var i = 0; i < events.length; i++) {
        events[i].date_shift_from_zero = (Date.parse(events[i].datetime_local) - firstDate)/timespan;
        var bufferWidth = 100;
        var pixelShift = ($("div#timeline").width() - bufferWidth) * events[i].date_shift_from_zero - 16 + (0.5 * bufferWidth);
        
        var html = "<div class='timeline-points' style='margin-left: " + Math.round(pixelShift) + "px'>" + (i + 1) + "</div>";
        $("div#timeline-points").append(html);
        console.log("date " + (i + 1) + ": " + events[i].datetime_local);
      }

      $("div.timeline-points").hover(function() {
        $(this).toggleClass("active");
      });

      //$("pre.data").html(JSON.stringify(events, null, 4));
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
      .defer(d3.tsv, "/readme-airports.tsv")
      .defer(d3.jsonp, "http://api.seatgeek.com/2/events?performers.slug=jason-aldean&per_page=10&callback={callback}")
      .await(ready);

  function ready(error, us, airports, events) {
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
      svg.append("path")
        .datum({
          type: "MultiPoint",
          coordinates: [{
            0: evt.venue.location.lon,
            1: evt.venue.location.lat
          }]
        })
        .attr("class", "points event-" + evt.id)
        .attr("d", path.pointRadius(function(d) { return unselected_radius; }));
    });

  }

  

})();
