(function() {
  Array.prototype.last = function() { return this[this.length-1]; };

  var max_events = 7;

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
      .defer(d3.jsonp, "http://api.seatgeek.com/2/events?performers.slug=jason-aldean&per_page=" + max_events + "&callback={callback}")
      .await(ready);

  function ready(error, us, data) {
    var events = data.events,
        firstDate = Date.parse(events[0].datetime_local),
        timespan = Date.parse(events.last().datetime_local) - firstDate; //optionally use 'new Date()' to start timespan from current date

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
    events.forEach(function(evt, index) {
      var il = (index + 1).toString().length,
          location = evt.venue.location,
          coords = _.extend({}, [location.lon, location.lat]);
          dateShift = (Date.parse(evt.datetime_local) - firstDate)/timespan,
          bufferWidth = 100,
          classes = index ? "timeline-points" : "timeline-points active",
          pixelShift = ($("#timeline").width() - bufferWidth) * dateShift - 16 + (0.5 * bufferWidth);
          html = "<div class='" + classes + "' style='margin-left: " + Math.round(pixelShift) + "px' data-eventid='" + evt.id + "'>" + (index + 1) + "</div>";

      $("#timeline-points").append(html);

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

    // get seo data
    var seoUrl = "http://seatgeek.com/utility/mapseo?performer_id=918";
    var urlPieces = _.map(events, function(e, index) {
      return "&venues[" + index + "][state]=" + e.venue.state + "&venues[" + index + "][id]=" + e.venue.id;
    });
    var seoUrl = seoUrl + urlPieces.join("");
    $.ajax({
      url: seoUrl,
      success: function(data) {
        events.forEach(function(e, index) {
          var obj = {};

          var performers = _.map(e.performers, function(p) { 
            var o = {};
            o["id"] = p.id;
            o["short_name"] = p.short_name;
            o["slug"] = p.slug;
            return o; 
          });
          performers.shift();

          var lastDateVenue = daysSinceVenue = "never";
          for (var key in data.venue) {
            if (key == e.venue.id) {
              lastDateVenue = data.venue[key].date;
              daysSinceVenue = Math.round((new Date() - Date.parse(lastDateVenue))/(24*60*60*1000));
            }
          }

          var lastDateState = daysSinceState = "never";
          for (var key in data.states) {
            if (key == e.venue.state) { 
              lastDateState = data.states[key].date;
              daysSinceState = Math.round((new Date() - Date.parse(lastDateState))/(24*60*60*1000));
            }
          }
          
          obj["event_id"] = e.id;
          obj["performer_slug"] = e.performers[0].slug;
          obj["performer_short_name"] = e.performers[0].short_name;
          obj["venue_id"] = e.venue.id;
          obj["venue_name"] = e.venue.name;
          obj["venue_state"] = e.venue.state;
          obj["last_date_venue"] = lastDateVenue;
          obj["last_date_state"] = lastDateState;
          obj["days_since_venue"] = daysSinceVenue;
          obj["days_since_state"] = daysSinceState;
          obj["openers"] = performers;
          
          $("[data-eventid='" + e.id + "']").data("info", obj);
        });
      },
      dataType: "jsonp"
    });

    // activate stuff on mouseenter of timeline points
    $(".timeline-points").mouseenter(function() {
      $(".timeline-points").removeClass("active");
      $(this).addClass("active");

      $("svg path.points").each(function() {
        $(this).attr("class", $(this).attr("class").replace(" active", ""));
      });
      var thisMapPoint = $("svg path.points.event-" + $(this).attr("data-eventid"));
      thisMapPoint.attr("class", thisMapPoint.attr("class") + " active");

      var thisObjInfo = $(this).data("info");
      var openerHtml = _.map(thisObjInfo.openers, function(o, i) {
        return "<a href='http://seatgeek.com/" + o.slug + "-tickets'>" + o.short_name + "</a>"
      });
      $("span.openers").html(openerHtml.join(", "));
      $("span.performer-name").text(thisObjInfo.performer_short_name);
      $("span.venue-name").text(thisObjInfo.venue_name);
      $("span.state-name").text(thisObjInfo.venue_state);
      $("span.days-since-venue").text(thisObjInfo.days_since_venue);
      $("span.days-since-state").text(thisObjInfo.days_since_state);
    });

    // activate stuff on mouseenter of map points
    $("svg text.place-label, svg path.points").hover(function() {
      $("svg path.points, .timeline-points").each(function() {
        $(this).attr("class", $(this).attr("class").replace(" active",""));
      });
      var thisMapPoint = $(".points.event-" + $(this).attr("data-eventid"));
      thisMapPoint.attr("class", thisMapPoint.attr("class") + " active");
      var thisTimelinePoint = $(".timeline-points[data-eventid='" + $(this).attr("data-eventid") + "']");
      thisTimelinePoint.attr("class", thisTimelinePoint.attr("class") + " active");
    });

  }

})();
