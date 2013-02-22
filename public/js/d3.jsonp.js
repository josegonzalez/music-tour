d3.jsonp = function (url, callback) {
  function rand() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      c = '', i = -1;
    while (++i < 15) c += chars.charAt(Math.floor(Math.random() * 52));
    return c;
  }

  function create(url) {
    var e = url.match(/callback=d3\.jsonp\.(\w+)/),
      c = e ? e[1] : rand();
    d3.jsonp[c] = function(data) {
      callback(null, data);
      delete d3.jsonp[c];
      script.remove();
      return data;
    };
    return 'd3.jsonp.' + c;
  }
  var cb = create(url);

  var script = d3.select('head')
    .append('script')
    .attr('type', 'text/javascript')
    .attr('src', url.replace("{callback}", cb));
};
