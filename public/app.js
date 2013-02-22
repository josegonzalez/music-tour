(function() {
  Array.prototype.last = function() { return this[this.length-1]; };

  Array.prototype.chunk = function(chunkSize) {
    var array=this;
    return [].concat.apply([],
        array.map(function(elem,i) {
            return i%chunkSize ? [] : [array.slice(i,i+chunkSize)];
        })
    );
  };

  var pages = {},
      current_page = 0;
      max_events = 20,
      height = 500,
      width = 790;

  var radius = d3.scale.sqrt()
      .domain([0, 1e6])
      .range([0, 10]);

  var unselected_radius = radius(2500000);

  var projection = albersUsa();

  var path = d3.geo.path()
      .projection(projection)
      .pointRadius(1.5);

  var svg = d3.select(".music-tour-map").append("svg")
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
    pages = data.events.chunk(7);

    // translucent outer glow
    svg.append("path")
        .datum(topojson.object(us, us.objects.land))
        .attr("d", path)
        .attr("class", "music-tour-glow");

    var state_group = svg.selectAll("states")
                        .data([1])
                        .enter()
                          .append("g")
                          .attr("class", "music-tour-states");
    // states
    topojson.object(us, us.objects.states).geometries.forEach(function(o, index) {
      state_group.append("path")
          .datum(o)
          .attr("d", path);
    });

    // draw the first page
    drawPage(0);
  }

  function clearPage() {
    svg.selectAll(".events")
      .data([])
      .exit()
      .remove();
  }

  function daysSince(d) {
    return Math.round((new Date() - Date.parse(d))/(24*60*60*1000));
  }

  function drawPage(page) {
    var events = pages[page],
        firstDate = Date.parse(events[0].datetime_local),
        timespan = Date.parse(events.last().datetime_local) - firstDate; //optionally use 'new Date()' to start timespan from current date

    // collect the events
    events.forEach(function(evt, index) {
      var il = (index + 1).toString().length,
          location = evt.venue.location,
          coords = _.extend({}, [location.lon, location.lat]);
          projectedCoords = projection(coords),
          dateShift = (Date.parse(evt.datetime_local) - firstDate)/timespan,
          bufferWidth = 300,
          pixelShift = ($(".music-tour-timeline").width() - bufferWidth) * dateShift - 16 + (0.5 * bufferWidth);
          html = "<div class='music-tour-timeline-points' style='margin-left: " + Math.round(pixelShift) + "px; z-index:" + (20-index) + "' data-eventid='" + evt.id + "'>" + (index + 1) + "</div>";

      $(".music-tour-timeline").append(html);

      function tooltip() {
        var that = $(d3.select(this));
        that.tooltip({
          container: "body",
          html: true,
          placement: (coords[0] > -100 ? "left" : "right"),
          title: [
            // '<div class="music-tour-stop">this stop</div>'
            '<div class="music-tour-info">' + evt.venue.city + ', ' + evt.venue.state + '</div>',
            '<div class="music-tour-info">' + evt.venue.name + '</div>'
          ].join("\n")});

        if ($(d3.event.fromElement).is("svg") || ($(d3.event.fromElement).is("path") && $(d3.event.toElement).is("path"))) that.tooltip("show");
      }

      var group = svg.selectAll("music-tour-events")
                    .data([1])
                    .enter()
                      .append("g")
                      .attr("event_id", evt.id)
                      .attr("class", "music-tour-events event-" + evt.id)
                      .on("mouseover", tooltip)
                      .on("tooltip", tooltip);

      group.append("path")
        .datum({type: "MultiPoint", coordinates: [coords]})
        .attr("class", "music-tour-points event-" + evt.id)
        .attr("data-eventid", evt.id)
        .attr("d", path.pointRadius(function(d) { return unselected_radius; }));
      group.append("text")
        .attr("class", "music-tour-label event-" + evt.id)
        .attr("data-eventid", evt.id)
        .attr("transform", function(d) { return "translate(" + projectedCoords + ")"; })
        .attr("x", function(d) { return (il > 1 ? -10 : -5); })
        .attr("y", function(d) { return coords[1] > -1 ? 1 : -1; })
        .attr("dy", ".35em")
        .text(function(d) { return index + 1; });
    });

    // get seo data
    var seoUrl = "http://seatgeek.com/utility/mapseo?performer_id=918";
    var urlPieces = _.map(events, function(e, index) {
      return "&venues[" + index + "][state]=" + e.venue.state + "&venues[" + index + "][id]=" + e.venue.id;
    });

    seoUrl = seoUrl + urlPieces.join("");
    $.ajax({
      url: seoUrl,
      success: function(data) {
        events.forEach(function(e, index) {
          var lastDateVenue = "never",
              daysSinceVenue = "never",
              lastDateState = "never",
              daysSinceState = "never";

          var openers = _.map(e.performers, function(p) {
            return {
              "id": p.id,
              "short_name": p.short_name,
              "slug": p.slug
            };
          });
          openers.shift();

          for (var venue_id in data.venue) {
            if (venue_id == e.venue.id) {
              lastDateVenue = data.venue[venue_id].date;
              daysSinceVenue = daysSince(lastDateVenue);
            }
          }

          for (var state in data.states) {
            if (state == e.venue.state) {
              lastDateState = data.states[state].date;
              daysSinceState = daysSince(lastDateState);
            }
          }

          var obj = {
            "event_id": e.id,
            "performer_slug": e.performers[0].slug,
            "performer_short_name": e.performers[0].short_name,
            "venue_id": e.venue.id,
            "venue_name": e.venue.name,
            "venue_state": states[e.venue.state],
            "last_date_venue": lastDateVenue,
            "last_date_state": lastDateState,
            "days_since_venue": daysSinceVenue,
            "days_since_state": daysSinceState,
            "openers": openers
          };

          if (index === 0) {
            activatePoints(e.id);
            writeSeoData(obj);
          }

          // attach seo data object to relevant points and point labels for getting later on mouseover
          $(".music-tour-timeline-points[data-eventid='" + e.id + "'], svg path.points.event-" + e.id + ", svg text.place-label.event-" + e.id).data("info", obj);
        });
      },
      dataType: "jsonp"
    });

    // do things on mouseenter of timeline points
    $(".music-tour-timeline-points").mouseenter(function() {
      activatePoints($(this).attr("data-eventid"));
      writeSeoData($(this).data("info"));
    });

    // do things on mouseenter of map points
    $("svg .music-tour-label, svg .music-tour-points").hover(function() {
      activatePoints($(this).attr("data-eventid"));
      writeSeoData($(this).data("info"));
    });

    function activatePoints(eventId) {
      // first deactivate all points
      $("svg .music-tour-points, .music-tour-timeline-points").each(function() {
        $(this).attr("class", $(this).attr("class").replace(" active",""));
      });

      // then activate the correct point on the timeline & map
      $(".music-tour-timeline-points[data-eventid='" + eventId + "'], svg .music-tour-points.event-" + eventId).each(function() {
        $(this).attr("class", $(this).attr("class") + " active");
      });
    }

    function writeSeoData(thisObjInfo) {
      var openerHtml = _.map(thisObjInfo.openers, function(o, i) {
        return "<a href='http://seatgeek.com/" + o.slug + "-tickets'>" + o.short_name + "</a>";
      });
      $(".music-tour-openers").html(openerHtml.join(", "));
      $(".music-tour-performer-name").text(thisObjInfo.performer_short_name);
      $(".music-tour-venue-name").text(thisObjInfo.venue_name);
      $(".music-tour-state-name").text(thisObjInfo.venue_state);
      $(".music-tour-days-since-venue").text(thisObjInfo.days_since_venue);
      $(".music-tour-days-since-state").text(thisObjInfo.days_since_state);
    }

    var states = {
      'AL': 'Alabama',
      'AK': 'Alaska',
      'AZ': 'Arizona',
      'AR': 'Arkansas',
      'CA': 'California',
      'CO': 'Colorado',
      'CT': 'Connecticut',
      'DE': 'Delaware',
      'DC': 'Washington, DC',
      'FL': 'Florida',
      'GA': 'Georgia',
      'HI': 'Hawaii',
      'ID': 'Idaho',
      'IL': 'Illinois',
      'IN': 'Indiana',
      'IA': 'Iowa',
      'KS': 'Kansas',
      'KY': 'Kentucky',
      'LA': 'Louisiana',
      'ME': 'Maine',
      'MD': 'Maryland',
      'MA': 'Massachusetts',
      'MI': 'Michigan',
      'MN': 'Minnesota',
      'MS': 'Mississippi',
      'MO': 'Missouri',
      'MT': 'Montana',
      'NE': 'Nebraska',
      'NV': 'Nevada',
      'NH': 'New Hampshire',
      'NJ': 'New Jersey',
      'NM': 'New Mexico',
      'NY': 'New York',
      'NC': 'North Carolina',
      'ND': 'North Dakota',
      'OH': 'Ohio',
      'OK': 'Oklahoma',
      'OR': 'Oregon',
      'PA': 'Pennsylvania',
      'RI': 'Rhode Island',
      'SC': 'South Carolina',
      'SD': 'South Dakota',
      'TN': 'Tennessee',
      'TX': 'Texas',
      'UT': 'Utah',
      'VT': 'Vermont',
      'VA': 'Virginia',
      'WA': 'Washington',
      'WV': 'West Virginia',
      'WI': 'Wisconsin',
      'WY': 'Wyoming'
    };

  }

})();
