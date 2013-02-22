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

  _.templateSettings = {
    interpolate : /\{\{(.+?)\}\}/g
  };


  var input       = $("#search-input"),
      searchForm  = $('#search-form'),
      searchGhost = $("#search-ghost");

  input
    .focus(function () {
      if (input.val() == input.attr("rel")) {
        input.val("");
        searchGhost.show();
      }
      searchForm.addClass('focused');
    })
    .blur(function() {
      if(input.val() === "") input.val(input.attr("rel"));
      searchGhost.hide();
      searchForm.removeClass('focused');
    })
    .bind('keydown paste cut', function() {
      setTimeout(function() {
        if(input.val() === "") searchGhost.fadeIn(200);
        else searchGhost.hide();
      }, 0);
    });


  $('.search-input')
    .on('focus', function() {
      $(".search-bg").addClass("focused");
    })
    .on('blur', function() {
      $(".search-bg").removeClass("focused");
    })
    .focus();


  window.MT = window.MT || {};

  MT.fire = function(slug) {
    if (MT.svg) MT.clearPage();
    $("svg").remove();
    $(".music-tour-events").remove();

    MT.pages = {};
    MT.current_page = 0;
    MT.chunk_size = 7;
    MT.max_events = 20;
    MT.total_pages = 0;
    MT.height = 500,
    MT.width = 790;

    MT.radius = d3.scale.sqrt()
        .domain([0, 1e6])
        .range([0, 10]);

    MT.unselected_radius = MT.radius(2500000);

    MT.projection = albersUsa();

    MT.path = d3.geo.path()
        .projection(MT.projection)
        .pointRadius(1.5);


    queue()
      .defer(d3.json, "/us.json")
      .defer(d3.jsonp, "http://api.seatgeek.com/2/events?performers.slug=" + slug + "&per_page=" + MT.max_events + "&callback={callback}")
      .await(function(error, us, data) {
          // Ensure that the results are all from the US
          data.events = _.filter(data.events, function(evt) { return evt.venue.country == "US"; });

          if (data.events.length === 0) {
            // No events, error
            return;
          }

          // Setup the timeline
          var t = _.template($(".template-timeline").html());
          $(".music-tour-map-container .center").html(t());

          // Fix up the input box
          MT.artistName = data.events[0].performers[0].name;
          input.val(MT.artistName);
          input.blur();

          // Hack to ensure we can get SEO information
          MT.artistId = data.events[0].performers[0].id;

          // Add the events div to the bottom of the page
          MT.addEvents(data.events);

          MT.pages = data.events.chunk(MT.chunk_size);
          MT.total_pages = MT.pages.length;

          $(".music-tour-map").addClass("hasMap");
          MT.svg = d3.select(".music-tour-map").append("svg")
              .attr("viewBox", "0 0 " + MT.width + " " + MT.height)
              .attr("width", MT.width)
              .attr("height", MT.height);

          MT.svg.append("filter")
              .attr("id", "glow")
            .append("feGaussianBlur")
              .attr("stdDeviation", 5);

          // translucent outer glow
          var land = MT.svg.selectAll(".land")
                        .data([topojson.object(us, us.objects.land)])
                        .enter()
                          .append("path")
                            .attr("d", MT.path)
                            .attr("class", "music-tour-glow");

          var states = MT.svg.selectAll(".music-tour-states")
                          .data(topojson.object(us, us.objects.states).geometries)
                          .enter()
                            .append("path")
                              .attr("d", MT.path)
                              .attr("class", "music-tour-states");

          // draw the first page (initialized to 0)
          MT.nextPage();
        });
  };

  MT.addEvents = function(events) {
    var t = _.template($(".template-event").html()),
        urlPieces = _.map(_.map(events, function(evt) { return evt.performers[0].id; }), function(performer, index) {
          return "&id=" + performer;
        }),
        url = "http://api.seatgeek.com/2/performers?callback=addEvents" + urlPieces.join("");

    $.ajax({
      url: url,
      dataType: "jsonp",
      success: function(data) {
        $(".the-blue").before('<div class="music-tour-events"><div class="center"></div></div>');
        var $el = $(".music-tour-events .center");
        events.forEach(function(evt, index) {
          performer_id = evt.performers[0].id;
          performer = _.find(data.performers, function(p) { return p.id == performer_id; });
          spotify = _.find(performer.links, function(link) { return link.provider == "spotify"; });
          $el.append(t({event: evt, index: index, spotify: spotify}));
        });

        $(".music-tour-event-image-container").popover({
          html: true,
          placement: "top",
          content: function() {
            var spotify_id = $(this).attr("spotify");
            if (spotify_id) {
              return '<iframe src="https://embed.spotify.com/?uri=' + spotify_id + '" width="250" height="80" frameborder=0 scrolling="no" marginwidth=0 marginheight=0 allowtransparency="true"></iframe>';
            } else {
              return "Sorry, no song available for this artist";
            }
          }
        });
      }
    });
  };

  MT.clearPage = function() {
    $(".music-tour-seo").remove();
    $(".music-tour-timeline-points").remove();
    MT.svg.selectAll(".music-tour-events")
      .data([])
      .exit()
      .remove();
  };

  MT.nextPage = function() {
    if (MT.current_page < MT.total_pages) {
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

    var events = MT.pages[page - 1],
        index_start = (MT.current_page - 1) * MT.chunk_size,
        firstDate = Date.parse(events[0].datetime_local),
        timespan = Date.parse(events.last().datetime_local) - firstDate;

    var html = _.map(events, function(evt, index) {
      var event_number = index + 1 + index_start,
          pixelShift = MT.pixelShift(evt.datetime_local, firstDate, timespan);
      return "<div class='music-tour-timeline-points' style='margin-left: " + pixelShift + "px; z-index:" + (20-index) + "' data-event-id='" + evt.id + "'>" + (event_number) + "</div>";
    });

    $(".music-tour-timeline").append(html);

    MT.getSeoData(events);

    var group = MT.svg.selectAll(".music-tour-events").data(events).enter()
                    .append("g")
                    .attr("data-event-id", function(d, index) { return d.id; })
                    .attr("class", function(d) { return "music-tour-events event-" + d.id; } )
                    .on("mouseover", MT.tooltip);

    group.append("path")
      .attr("class", function(d, index) { return "music-tour-points event-" + d.id; })
      .attr("data-event-id", function(d, index) { return d.id; })
      .datum(function(d, index) { return {type: "Point", coordinates: _.extend({}, [d.venue.location.lon, d.venue.location.lat])}; })
      .attr("d", MT.path.pointRadius(function(d) { return MT.unselected_radius; }));
    group.append("text")
      .attr("class", function(d, index) { return "music-tour-label event-" + d.id; })
      .attr("data-event-id", function(d, index) { return d.id; })
      .attr("transform", function(d, index) { return "translate(" + MT.projection(_.extend({}, [d.venue.location.lon, d.venue.location.lat])) + ")"; })
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
      case MT.chunk_size:
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
    var seoUrl = "http://seatgeek.com/utility/mapseo?performer_id=" + MT.artistId;
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

          pri_performer = e.performers.shift();

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
            "performer_slug": pri_performer.slug,
            "performer_short_name": pri_performer.short_name,
            "venue_id": e.venue.id,
            "venue_name": e.venue.name,
            "venue_state": MT.states[e.venue.state],
            "last_date_venue": lastDateVenue,
            "last_date_state": lastDateState,
            "days_since_venue": daysSinceVenue,
            "days_since_state": daysSinceState,
            "openers": e.performers ? e.performers : []
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

    var t = _.template($(".template-seo").html());
    $(".music-tour-seo").remove();
    $(".music-tour-map-container").after(t({opener: openerHtml, info: thisObjInfo}));
  };

  MT.getParameterByName = function(name) {
    name = name.replace(/[\[]/, "\\\\[").replace(/[\]]/, "\\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);
    if (results) {
      return decodeURIComponent(results[1].replace(/\+/g, " "));
    }
    return "";
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

  if (MT.getParameterByName("performer")) {
    MT.fire(MT.getParameterByName("performer"));
  }


})();
