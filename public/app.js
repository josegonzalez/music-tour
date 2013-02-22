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
      chunk_size = 7,
      max_events = 20,
      total_pages = 0,
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

  window.MT = window.MT || {};
  MT.current_page = 0;

  function ready(error, us, data) {
    pages = data.events.chunk(chunk_size);
    total_pages = pages.length;

    // translucent outer glow
    var land = svg.selectAll(".land")
                  .data([topojson.object(us, us.objects.land)])
                  .enter()
                    .append("path")
                      .attr("d", path)
                      .attr("class", "music-tour-glow");

    var states = svg.selectAll(".music-tour-states")
                    .data(topojson.object(us, us.objects.states).geometries)
                    .enter()
                      .append("path")
                        .attr("d", path)
                        .attr("class", "music-tour-states");

    // draw the first page (initialized to 0)
    MT.nextPage();
  }

  MT.clearPage = function() {
    $(".music-tour-timeline-points").remove();
    svg.selectAll(".music-tour-events")
      .data([])
      .exit()
      .remove();
  };

  MT.nextPage = function() {
    if (MT.current_page < total_pages) {
      MT.current_page++;
      MT.drawPage(MT.current_page);
    }
  };

  MT.previousPage = function() {
    if (MT.current_page > 1) {
      active_last = true;
      MT.current_page--;
      MT.drawPage(MT.current_page, active_last);
    }
  };

  MT.drawPage = function(page, active_last) {
    active_last = active_last || false;
    MT.clearPage();

    var events = pages[page - 1],
        index_start = (MT.current_page - 1) * chunk_size,
        firstDate = Date.parse(events[0].datetime_local),
        timespan = Date.parse(events.last().datetime_local) - firstDate;

    var html = _.map(events, function(evt, index) {
      var event_number = index + 1 + index_start,
          pixelShift = MT.pixelShift(evt.datetime_local, firstDate, timespan);
      return "<div class='music-tour-timeline-points' style='margin-left: " + pixelShift + "px; z-index:" + (20-index) + "' data-event-id='" + evt.id + "'>" + (event_number) + "</div>";
    });

    $(".music-tour-timeline").append(html);

    MT.getSeoData(events);

    var group = svg.selectAll(".music-tour-events").data(events).enter()
                    .append("g")
                    .attr("data-event-id", function(d, index) { return d.id; })
                    .attr("class", function(d) { return "music-tour-events event-" + d.id; } )
                    .on("mouseover", MT.tooltip);

    group.append("path")
      .attr("class", function(d, index) { return "music-tour-points event-" + d.id; })
      .attr("data-event-id", function(d, index) { return d.id; })
      .datum(function(d, index) { return {type: "Point", coordinates: _.extend({}, [d.venue.location.lon, d.venue.location.lat])}; })
      .attr("d", path.pointRadius(function(d) { return unselected_radius; }));
    group.append("text")
      .attr("class", function(d, index) { return "music-tour-label event-" + d.id; })
      .attr("data-event-id", function(d, index) { return d.id; })
      .attr("transform", function(d, index) { return "translate(" + projection(_.extend({}, [d.venue.location.lon, d.venue.location.lat])) + ")"; })
      .attr("x", function(d, index) { return ((index_start + index + 1).toString().length > 1 ? -10 : -5); })
      .attr("y", function(d, index) {
        var coords = _.extend({}, [d.venue.location.lon, d.venue.location.lat]);
        return coords[1] > -1 ? 1 : -1;
      })
      .attr("dy", ".35em")
      .text(function(d, index) { return index_start + index + 1; });

    // do things on click of backward/forward arrows
    $(".music-tour-timeline-arrow").unbind("click");
    $(".music-tour-timeline-points").unbind("mouseenter");
    $("svg .music-tour-label, svg .music-tour-points").unbind("hover");

    $(".music-tour-timeline-arrow").click(function(e) {
      e.preventDefault();
      var direction = $(this).hasClass("music-tour-forward") ? "forward" : $(this).hasClass("music-tour-backward") ? "backward" : "";
      MT.shiftActivePoint(direction, events);
    });

    // do things on mouseenter of timeline points
    $(".music-tour-timeline-points").mouseenter(function() {
      MT.reactivatePoints($(this), $(this).css("z-index"));
    });

    // do things on mouseenter of map points
    $(".music-tour-label, .music-tour-points").hover(function() {
      MT.reactivatePoints($(this));
    });
  };

  MT.tooltip = function(d, index) {
    var that = $(d3.select(this)),
        coords = _.extend({}, [d.venue.location.lon, d.venue.location.lat]),
        isFromSvg = $(d3.event.fromElement).is("svg"),
        isFromPath = $(d3.event.fromElement).is("path"),
        isToPath = $(d3.event.toElement).is("path");

    that.tooltip({
      container: "body",
      html: true,
      placement: (coords[0] > -100 ? "left" : "right"),
      title: [
        // '<div class="music-tour-stop">this stop</div>'
        '<div class="music-tour-info">' + d.venue.city + ', ' + d.venue.state + '</div>',
        '<div class="music-tour-info">' + d.venue.name + '</div>'
      ].join("\n")});

    if (isFromSvg || (isFromPath && isToPath)) that.tooltip("show");
  };

  MT.shiftActivePoint = function(direction, events) {
    var x = (direction == "forward") ? 1 : "backward" ? -1 : 0;
    var index = MT.currentActiveIndex(events);
    switch(x + index) {
      case chunk_size:
        MT.nextPage();
        break;
      case -1:
        MT.previousPage();
        break;
      default:
        if (direction == "forward") {
          next = MT.nextActiveIndex(events);
          if (_.isNumber(next)) MT.activatePoints(next);
        } else {
          previous = MT.previousActiveIndex(events);
          if (_.isNumber(previous)) MT.activatePoints(previous);
        }
    }
  };

  MT.currentEventId = function() {
    return $(".music-tour-timeline-points.active").data("event-id");
  };

  MT.currentActiveIndex = function(events) {
    var event_ids = _.pluck(events, "id");
    return event_ids.indexOf(MT.currentEventId());
  };

  MT.nextActiveIndex = function(events) {
    var event_ids = _.pluck(events, "id");
    return event_ids[MT.currentActiveIndex(events) + 1];
  };

  MT.previousActiveIndex = function(events) {
    var event_ids = _.pluck(events, "id");
    return event_ids[MT.currentActiveIndex(events) - 1];
  };

  MT.daysSince = function(d) {
    var days = Math.round((new Date() - Date.parse(d))/(24*60*60*1000));
    return days + " day" + (days === 1 ? '': 's') + " ago";
  };

  MT.pixelShift = function(datetime_local, first_date, timespan) {
    var date_shift = (Date.parse(datetime_local) - first_date) / timespan,
        buffer_width = 300;
        pixels = ($(".music-tour-timeline").width() - buffer_width) * date_shift - 16 + (0.5 * buffer_width);
    return Math.round(pixels);
  };


  MT.reactivatePoints = function($that, zindex) {
    MT.activatePoints($that.attr("data-event-id"), zindex);
    MT.writeSeoData($that.data("info"));
  };

  MT.activatePoints = function(eventId, zindex) {
    if (typeof zindex !== 'undefined') {
      $(".music-tour-timeline-points.active").css("z-index", zindex);
    }

    // first deactivate all points
    $("svg .music-tour-points, .music-tour-timeline-points").each(function() {
      $(this).attr("class", $(this).attr("class").replace(" active",""));
    });

    // then activate the correct point on the timeline & map
    $(".music-tour-timeline-points[data-event-id='" + eventId + "'], svg .music-tour-points.event-" + eventId).each(function() {
      $(this).attr("class", $(this).attr("class") + " active");
    });
    $(".music-tour-timeline-points[data-event-id='" + eventId + "']").css("z-index", 30);
  };

  // get seo data
  MT.getSeoData = function(events) {
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

          e.performers.shift();

          for (var venue_id in data.venue) {
            if (venue_id == e.venue.id) {
              daysSinceVenue = MT.daysSince(lastDateVenue = data.venue[venue_id].date);
            }
          }

          for (var state in data.states) {
            if (state == e.venue.state) {
              daysSinceState = MT.daysSince(lastDateState = data.states[state].date);
            }
          }

          var obj = {
            "event_id": e.id,
            "performer_slug": e.performers[0].slug,
            "performer_short_name": e.performers[0].short_name,
            "venue_id": e.venue.id,
            "venue_name": e.venue.name,
            "venue_state": MT.states[e.venue.state],
            "last_date_venue": lastDateVenue,
            "last_date_state": lastDateState,
            "days_since_venue": daysSinceVenue,
            "days_since_state": daysSinceState,
            "openers": e.performers
          };

          if (index === 0) {
            MT.activatePoints(e.id);
            MT.writeSeoData(obj);
          }

          // attach seo data object to relevant points and point labels for getting later on mouseover
          $(".music-tour-timeline-points[data-event-id='" + e.id + "'], svg .music-tour-points.event-" + e.id + ", svg .music-tour-label.event-" + e.id).data("info", obj);
        });
      },
      dataType: "jsonp"
    });
  };

  MT.writeSeoData = function(thisObjInfo) {
    var openerHtml = _.map(thisObjInfo.openers, function(o, i) {
      return "<a href='http://seatgeek.com/" + o.slug + "-tickets'>" + o.short_name + "</a>";
    });
    $(".music-tour-openers").html(openerHtml.join(", "));
    $(".music-tour-performer-name").text(thisObjInfo.performer_short_name);
    $(".music-tour-venue-name").text(thisObjInfo.venue_name);
    $(".music-tour-state-name").text(thisObjInfo.venue_state);
    $(".music-tour-days-since-venue").text(thisObjInfo.days_since_venue);
    $(".music-tour-days-since-state").text(thisObjInfo.days_since_state);
  };

  MT.states = {
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

})();
