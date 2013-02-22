(function ($) {

  $.widget("ui.sgautocomplete", {
    // default options
    options: {
      minLength: 2,
      delay:     200,
      source:    function (request, response) {},
      parent:    $("body"),
      presubmit: null,
      select:    function(item) { document.location = item.attr("href"); },
      see_all:   true
    },
    _create: function() {
      var that = this,
          doc  = this.element[0].ownerDocument;
      this.element
            .addClass("ui-sgautocomplete-input")
            .attr("autocomplete", "off")
            .bind("keydown.sgautocomplete", function (e) {
              var keyCode = $.ui.keyCode;
              switch( e.keyCode ) {
                case keyCode.UP:
                  that._move( "previous", e );
                  // prevent moving cursor to beginning of text field in some browsers
                  e.preventDefault();
                  break;
                case keyCode.DOWN:
                  that._move( "next", e );
                  // prevent moving cursor to end of text field in some browsers
                  e.preventDefault();
                  break;
                case keyCode.ENTER:
                  if (that.menu.is(":visible") && that.focus && that.focus > 0) { // just let the form submit for the first item
                    e.preventDefault();
                  }
                case keyCode.TAB:
                  if (!that.menu.is(":visible")) {
                    return;
                  }
                  that.select();
                  break;
                case keyCode.ESCAPE:
                  that.close();
                  break;
                case keyCode.SHIFT:
                case keyCode.CONTROL:
                case 18:
                  // ignore metakeys (shift, ctrl, alt)
                  break;
                default:
                  // keypress is triggered before the input value is changed
                  clearTimeout( that.searching );
                  that.searching = setTimeout(function() {
                    that.search( null, e );
                  }, that.options.delay );
                  break;
                }
            })
            // it doesn't seem like having the enter logic only in the keydown event
            // works for all browsers
            .bind("keypress.sgautocomplete", function (e) {
              var keyCode = $.ui.keyCode;
              switch( e.keyCode ) {
                case keyCode.ENTER:
                  if (that.menu.is(":visible") && that.focus && that.focus > 0) { // just let the form submit for the first item
                    e.preventDefault();
                  }
                  break;
                default:
                  break;
              }
            })
            .bind("focus.sgautocomplete", function () {
              // show the list?
            })
            .bind("blur.sgautocomplete", function () {
              that.close();
            });

      this.source = this.options.source;

      this.response = function () {
        return that._response.apply(that, arguments);
      };

      this.focus = null;

      this.menu = $("<div></div>")
            .addClass("ui-sgautocomplete")
            .appendTo(this.options.parent)
            .css({ left: "3px", top: (this.options.parent.height() + 78) + "px" })
            .hide();
    },
    search: function (value, e) {
      value = value != null ? value : this.element.val();
      if (value.length < this.options.minLength) {
        return this.close(e);
      }

      clearTimeout(this.closing);

      this.term = this.element.val();
      jQuery('.sg-loading-indicator').show();

      this.source({ term: value }, this.response);
    },
    select: function (item) {
      if (typeof this.options.presubmit === 'function') {
          this.options.presubmit.call(this);
      }

      item = item || this.items.eq(this.focus);
      if (item.attr("href") != "#") {
        this.options.select.call(this, item);
        this.close();
      }
    },
    close: function (e) {
      var that = this;
      clearTimeout(this.closing);
      this.closing = setTimeout(function () {
        that._blur();
        that.menu.hide();
      }, 300); // this timeout needs to be fairly long to prevent longer clicks from
               // killing the menu before the click event can fire
    },
    // Can optionally adjust these to scale types:
    _coefficients: {
      'teamband': 1.0,
      'event':    1.0,
      'venue':    1.0,
      'tournament': 1.0
    },
    _apply_coefficient: function (obj, type) {
      var o = jQuery.extend({}, obj);
      if (o.score) {
        o.score = o.score * this._coefficients[type];
      }

      return o;
    },
    _response: function (response) {
      // response is in our special multi-format

      // we expect "event", "teamband", and "venue" results
      var that    = this,
          results = response.results,
          term    = response.term,
          tophits = [],
          total_matches = 0,
          k;

      // add one from each type if available and apply coefficients
      // to create an even playing field
      $.each(['teamband', 'event', 'venue', 'tournament'], function (i, k) {
        if (results[k] && results[k].length) {
          tophits.push(that._apply_coefficient(results[k][0], k));
          total_matches += results[k].length;
        }
      });

      tophits.sort(function(a,b) {
        if (a.score == b.score) return 0;
        return a.score < b.score ? 1 : -1;
      });

      if (tophits.length) {
        if (total_matches > 1) results.tophit = [tophits[0]];
        this._renderMenu(results, term);
      } else {
        this.close();
      }

      jQuery('.sg-loading-indicator').hide();
    },
    _renderMenu: function (results, term) {
      var that = this,
          table = $('<table></table>').css({ borderCollapse: "collapse" }).width("100%"),
          tbody = $('<tbody></tbody>').appendTo(table);

      this.menu
            .empty()
            .append(table);

      if (this.options.see_all) {
        this._renderSection(tbody, "", [{ term: "See all results...", data: { url: "#" } }]);
      }

      $.each(["tophit", "teamband", "event", "venue", "tournament"], function (i, section) {
        if (results[section] && results[section].length)
          that._renderSection(tbody, section, results[section]);
      });

      this.focus = null;
      this.items = this.menu.find(".sgautocomplete-result");
      this._move("down");

      this.menu.show();
    },
    _renderSection: function (elem, section, items) {
      var that = this,
          row = $('<tr></tr>'),
          list,
          name = {
            tophit:     "Top Result",
            teamband:   "Performers",
            event:      "Events",
            venue:      "Venues",
            tournament: "Tournaments"
          }[section] || "";

      if (elem.is(":empty")) row.addClass("sgautocomplete-row-first");
      row
        .html([
          '<td class="sgautocomplete-results-icon"><div class="icon-' + section + '"></div></td>',
          '<td class="sgautocomplete-results-wrap">',
            '<div class="sgautocomplete-results-label">' + name + '</div>',
            '<div class="sgautocomplete-results"></div>',
          '</td>'
        ].join("\n"))
        .appendTo(elem);
      list = row.find(".sgautocomplete-results").eq(0);
      $.each(items, function (i, item) {
        that._renderItem(list, item);
      });
    },
    _renderItem: function (elem, item) {
      var that = this;
      $('<a class="sgautocomplete-result"></a>')
          .html([
            '<span class="sgautocomplete-result-title">' + item.term + '</span>',
            item.data.subtitle ? '<span class="sgautocomplete-result-subtitle">' + item.data.subtitle + '</span>' : ''
          ].join("\n"))
          .mouseenter(function (e) {
            that._blur();
            that._focus(this);
          })
          .click(function (e) {
            clearTimeout(that.closing);
            if (that.focus === 0) { // only for the first item
              that.element.parents("form").submit();
              e.preventDefault();
            }
            that.select($(this));
          })
          .attr("href", item.data.url)
          .attr("rel", item.id ? item.id : null)
          .appendTo(elem);
    },
    _move: function (direction, e) {
      var new_index = null;
      if (direction == "previous") {
        if (this.focus === null || this.focus === 0) {
          new_index = null;
        } else {
          new_index = this.focus - 1;
        }
      }
      // direction must be "next"
      else if (this.focus === null) {
        // "next" and nothing selected so far
        new_index = 0;
      }
      else {
        new_index = this.focus + 1;
      }
      this._blur();
      if (new_index !== null) {
        new_index = Math.min(new_index, this.items.length - 1);
        new_index = Math.max(new_index, 0);
        this._focus(new_index);
      }
    },
    _focus: function (index) {
      if (index.nodeType) {
        // index is actually a dom element
        // find its index in this.items
        $.each(this.items, function (i, item) {
          if (item === index) {
            index = i;
          }
        });
      }
      this.focus = index;
      this.items.eq(index).addClass("sgautocomplete-result-focus");
    },
    _blur: function () {
      if (this.focus !== null) {
        this.items.eq(this.focus).removeClass("sgautocomplete-result-focus");
        this.focus = null;
      }
    }

  });

})(jQuery);

