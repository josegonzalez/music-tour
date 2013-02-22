function initiateAutocomplete() {
  window.MT = window.MT || {};
  var cache = {},
      url = "http://api.seatgeek.com/2/autocomplete?types[]=teamband&taxonomies.name=concert&callback=?",
      lastXhr,
      options = {
        minLength: 2,
        delay: 125,
        parent: jQuery('.search-form, .search-structure'),
        see_all: false,
        select:    function(item) {
          var slug = item.attr("href").replace("/", "").replace("-tickets/", "");
          MT.fire(slug);
        },
        source: function(request, response) {
          var params = {
            term:  request.term,
            limit: 10
          };

          var term = request.term;
          if (term in cache) {
            response(cache[term]);
            return;
          }

          lastXhr = jQuery.getJSON(url, params, function(data, status, xhr) {
            cache[ term ] = data;
            if (xhr === lastXhr) {
              response(data);
            }
          }).error(function() { response({term: term, results: {}}); });
        }
      };

  jQuery("#search-bar-input").add("#searchBarInput").add("#search-input").sgautocomplete(options);
}
jQuery(function() {
  initiateAutocomplete();
});
