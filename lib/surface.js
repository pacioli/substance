//     (c) 2012 Victor Saiz, Michael Aufreiter

//     Surface is freely distributable under the MIT license.
//     For all details and documentation:
//     http://github.com/surface/surface

(function (w) {

  // Backbone.Events
  // -----------------

  // Regular expression used to split event strings
  var eventSplitter = /\s+/;

  var slice = Array.prototype.slice;
  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback functions
  // to an event; trigger`-ing an event fires all callbacks in succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
    _.Events = w.Backbone ? Backbone.Events : {

    // Bind one or more space separated events, `events`, to a `callback`
    // function. Passing `"all"` will bind the callback to all events fired.
    on: function (events, callback, context) {

      var calls, event, node, tail, list;
      if (!callback) return this;
      events = events.split(eventSplitter);
      calls = this._callbacks || (this._callbacks = {});

      // Create an immutable callback list, allowing traversal during
      // modification.  The tail is an empty object that will always be used
      // as the next node.
      while (event = events.shift()) {
        list = calls[event];
        node = list ? list.tail : {};
        node.next = tail = {};
        node.context = context;
        node.callback = callback;
        calls[event] = {tail: tail, next: list ? list.next : node};
      }
      return this;
    },

    // Remove one or many callbacks. If `context` is null, removes all callbacks
    // with that function. If `callback` is null, removes all callbacks for the
    // event. If `events` is null, removes all bound callbacks for all events.
    off: function(events, callback, context) {
      var event, calls, node, tail, cb, ctx;

      // No events, or removing *all* events.
      if (!(calls = this._callbacks)) return;
      if (!(events || callback || context)) {
        delete this._callbacks;
        return this;
      }

      // Loop through the listed events and contexts, splicing them out of the
      // linked list of callbacks if appropriate.
      events = events ? events.split(eventSplitter) : _.keys(calls);
      while (event = events.shift()) {
        node = calls[event];
        delete calls[event];
        if (!node || !(callback || context)) continue;
        // Create a new list, omitting the indicated callbacks.
        tail = node.tail;
        while ((node = node.next) !== tail) {
          cb = node.callback;
          ctx = node.context;
          if ((callback && cb !== callback) || (context && ctx !== context)) {
            this.on(event, cb, ctx);
          }
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(events) {
      var event, node, calls, tail, args, all, rest;
      if (!(calls = this._callbacks)) return this;
      all = calls.all;
      events = events.split(eventSplitter);
      rest = slice.call(arguments, 1);

      // For each event, walk through the linked list of callbacks twice,
      // first to trigger the event, then to trigger any `"all"` callbacks.
      while (event = events.shift()) {
        if (node = calls[event]) {
          tail = node.tail;
          while ((node = node.next) !== tail) {
            node.callback.apply(node.context || this, rest);
          }
        }
        if (node = all) {
          tail = node.tail;
          args = [event].concat(rest);
          while ((node = node.next) !== tail) {
            node.callback.apply(node.context || this, args);
          }
        }
      }

      return this;
    }
  };


  // Substance
  // ---------

  if (!w.Substance || !Substance) { w.Substance = Substance = {}; }

  // Surface
  // ---------

  Substance.Surface = function(options) {

    var $el = $(options.el),
        el = options.el,
        selectionIsValid = false,
        annotations = options.annotations,
        types = options.types || {},
        content = options.content || '',
        prevContent = content,
        active = false,
        pasting = false,
        that = this;

    var dirtyNodes = {};

    function renderAnnotations() {
      // Cleanup
      $(el.childNodes).removeClass();
      // Render annotations
      _.each(annotations, function(a) {

        if (typeof types[a.type] !== 'undefined') { // visibility is set
          
          if (active) {
            if (types[a.type].visibility === 'both' || types[a.type].visibility === 'active') {
              elements(a.pos).addClass(a.type);
            }
          } else {
            if (types[a.type].visibility === 'both' || types[a.type].visibility === 'inactive') {
              elements(a.pos).addClass(a.type);
            }
          }
        } else { // visibility is not set
          elements(a.pos).addClass(a.type);
        }

      });
    }

    // Initialize Surface
    // ---------------

    function initContent() {
      $el.empty();
      _.each(content.split(''), function(ch) {
        if (ch === "\n") {
          $el.append('<br/>');
        } else {
          $el.append($('<span>'+ch+'</span>'));
        }
      });
    }

    // Regular init
    // TODO: obsolete?

    function init() {
      initContent();
      renderAnnotations();
    }

    // Highlight a particular annotation
    function highlight(id) {
      $el.find('.highlight').removeClass('highlight');
      var a = annotationById(id);
      if (a) elements(a.pos).addClass('highlight');
    }

    // Determines if a certain annotation is inclusive or not
    function isInclusive(a) {
      return (types[a.type]) ? types[a.type].inclusive : true;
    }

    // Set selection
    // ---------------

    function select(start, end) {
      if (!active) return;

      var sel = window.getSelection();
      var range = document.createRange();
      var children = el.childNodes;
      var numChild = children.length-1;
      var isLastNode = start > numChild;
      var startNode = isLastNode ? children[numChild] : children[start];
      var endNode = end ? children[end] : startNode;

      if (children.length > 0) {
      // here is text in the container
        if (!isLastNode) {
          range.setStartBefore(startNode);
        } else {
          range.setStart(startNode, 1);
          range.setEnd(startNode, 1);
        }

      } else {
      // No characters left in the container
        range.setStart(el, 0);
        range.setEnd(el, 0);
      }

      sel.removeAllRanges();
      sel.addRange(range);
    }

    function insertAnnotation(a) {
      annotations[a.id] = a;
      dirtyNodes[a.id] = "insert";
      renderAnnotations();
      that.trigger('annotations:changed');
    }

    // Get current selection
    // ---------------

    function selection() {
  
      var range = window.getSelection().getRangeAt(0);
      var length = range.cloneContents().childNodes.length;
      var startContainer = range.startContainer;
      var parent = startContainer.parentElement;
      var indexOf = Array.prototype.indexOf;

      // if(startContainer.nodeType === 3) index = $el.find('span, br').index(range.startContainer.parentElement);
      var index = startContainer.nodeType === 3 ? indexOf.call(el.childNodes, parent) : 0;

      // There's an edge case at the very beginning
      if (range.startOffset !== 0) index += 1;
      if (range.startOffset > 1) index = range.startOffset;

      return [index, length];
    }

    // Matching annotations [xxxx.]
    // ---------------

    // Original version (for reference)
    // function getAnnotations(sel, types) {
    //   var sStart = sel[0],
    //       sEnd   = sel[0] + sel[1];
    //
    //   return _.filter(annotations, function(a) {
    //     if (!sel) return true; // return all annotations
    //     var aStart = a.pos[0], aEnd = aStart + a.pos[1];
    //     var intersects = aStart <= sEnd && aEnd >= sStart;
    //     // Intersects and satisfies type filter
    //     return intersects && (types ? _.include(types, a.type) : true);
    //   });
    // }

    function getAnnotations(sel, aTypes) {

      if (sel) {
        var sStart = sel[0],
        sEnd   = sel[0] + sel[1];

        return _.filter(annotations, function(a) {
          var aStart = a.pos[0], aEnd = aStart + a.pos[1];
          
          if(types[a.type] && types[a.type].inclusive === false){
            // its a non inclusive annotation
            // so intersects doesnt include the prev and last chars
            var intersects = (aStart + 1) <= sEnd && (aEnd - 1) >= sStart;
          } else {
            var intersects = aStart <= sEnd && aEnd >= sStart;
          }
          // Intersects and satisfies type filter
          return intersects && (aTypes ? _.include(aTypes, a.type) : true);
      });

      } else {
        return annotations; // return all annotations
      }
    }

    function annotationById(id){
      return _.find(annotations, function(ann){ return ann.id == id; });
    }

    // Deletes passed in annotation
    // ---------------------------

    function deleteAnnotation(ann) {
      delete annotations[ann];
      // Flag as deleted so update events are sent appropriately
      dirtyNodes[ann] = "delete";
      that.trigger('annotations:changed');
      renderAnnotations();
    }

    function makeDirty(a) {
      if (dirtyNodes[a.id] === "insert") return; // new node -> leave untouched
      dirtyNodes[a.id] = "update";
    }

    // Transformers
    // ---------------

    function insertTransformer(index, offset) {
      // TODO: optimize
      _.each(annotations, function(a) {
        var aStart = a.pos[0],
            aEnd   = aStart + a.pos[1];

        if (aStart === index) {
        // Case1: insertion matching beginning
        // console.log('Case1: insertion matching beginning');

          if (isInclusive(a)) {
          // CaseA: inclusive
            makeDirty(a); // Mark annotation dirty
            a.isAffected = true;
            a.pos[1] += offset; // offseting tail 
            // console.log('inclusive, annotation is affected');
          }else{
            // if not including we have to push the begining
            // console.log('not including, we push the begining');
            a.pos[0] += offset;
            a.isAffected = false;
          }

        } else if (aStart < index && aEnd > index) {
        // Case2: insertion within annotation boundries
        // console.log('Case2: insertion within annotation boundries');
        // both inclusive and noninclusive react alike
        
        // marking dirty and offseting tail
        makeDirty(a);
        a.isAffected = true;
        a.pos[1] += offset;

      } else if (aEnd == index) {
        // Case3: insertion matching ending
        // console.log('Case3: insertion matching ending');

        if (isInclusive(a)) {
          // CaseA: inclusive
          // Only inclusive affects the annotation
          // console.log('CaseA: inclusive');
          makeDirty(a);
          a.isAffected = true;
          a.pos[1] += offset;
        }else{
          a.isAffected = false;
        }

      } else if (aStart > index) {
        // Case2: subsequent annotations -> Startpos needs to be pushed
        a.pos[0] += offset;
        makeDirty(a); // Mark annotation as dirty
        a.isAffected = true;
      }

      });
    }

    function deleteTransformer(index, offset) {
      // TODO: optimize
      _.each(annotations, function(a) {
        var aStart = a.pos[0],
            aEnd   = aStart + a.pos[1],
            sStart = index,
            sEnd   = index + offset;

        // Case1: Full overlap or wrap around overlap -> delete annotation
        if (sStart <= aStart && sEnd >= aEnd) {
          dirtyNodes[a.id] = "delete";

          // console.log('Case1:Full overlap', a.type + ' will be deleted');
          deleteAnnotation(a.id);
        }
        // Case2: inner overlap -> decrease offset length by the lenth of the selection
        else if (aStart < sStart && aEnd > sEnd) {
          // console.log(a);
          a.pos[1] = a.pos[1] - offset;
          makeDirty(a); // Mark annotation dirty
          // console.log('Case2:inner overlap', a.type + ' decrease offset length by ' + offset);
        }
        // Case3: before no overlap -> reposition all the following annotation indexes by the lenth of the selection
        else if (aStart > sStart && sEnd < aStart) {
          a.pos[0] -= offset;
          makeDirty(a); // Mark annotation dirty
          // console.log('Case3:before no overlap', a.type + ' index repositioned');
        }
        // Case4: partial rightside overlap -> decrease offset length by the lenth of the overlap
        else if (sStart <= aEnd && sEnd >= aEnd) {
          var delta = aEnd - sStart;
          a.pos[1] -= delta;
          makeDirty(a); // Mark annotation dirty
          // console.log('Case4:partial rightside overlap', a.type + ' decrease offset length by ' + delta);
        }
        // Case5: partial leftSide -> reposition index of the afected annotation to the begining of the selection
        // ...... and decrease the offset according to the length of the overlap
        else if (sStart <= aStart && sEnd >= aStart ) {
          var delta = sEnd - aStart;
          a.pos[0] = sStart;
          a.pos[1] -= delta;
          makeDirty(a); // Mark annotation dirty
          // console.log('Case5:partial leftSide',  a.type + 'reposition index and decrease the offset by ' + delta);
        }
      });
      renderAnnotations();
    }


    // State
    // ---------------

    function getContent() {
      var res = "";
      _.each($el.find("span, br"), function(el) {
        res += el.tagName === "BR" ? "\n" : $(el).text();
      });
      return res;
    }

    function elements(range) {
      return $(slice.call(el.childNodes, range[0], range[0] + range[1]));
    }

    // Operations
    // ---------------

    function deleteRange(range) {
      if (range[0] < 0) return;

      elements(range).remove();

      select(range[0]);
      deleteTransformer(range[0], range[1]);
      that.trigger('changed');
    }

    // Stateful
    function insertCharacter(ch, index) {
      if (ch === " ") ch = "&nbsp;";
      
      var matched = getAnnotations([index,0]),
          classes = '';

      // we perform the transformation before to see if the inclusive/noninclusive
      // affects in order to apply the class or not
      insertTransformer(index, 1);

      _.each(matched, function(a) {
        if (a.isAffected) classes += ' ' + a.type;
      });

      var successor = el.childNodes[index];
      var newEl = 'span';

      if (ch === "\n") newEl = 'br';

      var newCh = document.createElement(newEl);
      if (ch !== "\n") newCh.innerHTML = ch;
      if (ch !== "\n") newCh.className = classes;

      if (successor) {
        el.insertBefore(newCh, successor);
      } else {
        el.appendChild(newCh);
      }

      select(index+1);
      that.trigger('changed');
    }

    // Used for pasting content
    function insertText(text, index) {
      var chars = _.map(text.split(''), function(ch, offset) {
        return '<span>'+ch+'</span>';
      }).join('');

      var successor = el.childNodes[index];
      if (successor) {
        $(chars).insertBefore(successor);
      } else {
        $(chars).appendTo($el);
      }

      insertTransformer(index, text.length);
      that.trigger('changed');
    }


    // Events
    // ------

    init();

    // Interceptors
    // -----------------
    // 
    // Overriding clumsy default behavior of contenteditable

    function handleKey(e) {
      if (e.ctrlKey || e.metaKey) { return; }
      var ch = String.fromCharCode(e.keyCode);

      // Is there an active selection?
      var range = selection();
      var index = range[0] < 0 ? 0 : range[0];

      if (range[1]) {
        deleteRange(range);
      }

      insertCharacter(ch, index);

      e.preventDefault();
      e.stopPropagation(); // needed?
    }

    function handlePaste(e) {
      var sel = selection();
      if(sel[1] > 0){
        deleteRange(sel);
      }
      pasting = true;

      function getPastedContent (callback) {
        var tmpEl = $('<div contenteditable="true" />')
          .css({
            position: 'fixed', top: '20px', left: '20px',
            opacity: '0', 'z-index': '10000',
            width: '1px', height: '1px'
          })
          .appendTo(document.body)
          .focus();
        setTimeout(function () {
          tmpEl.remove();
          callback(tmpEl);
        }, 10);
      }

      getPastedContent(function (node) {
        var txt = $(node).text().trim().replace(/\n/g, "");
        insertText(txt, sel[0]);
        select(sel[0]+txt.length);
        pasting = false;
      });
    }

    function handleBackspace(e) {
      if (active) {
        var sel = selection();
        sel[1]>0 ? deleteRange(sel) : deleteRange([sel[0]-1, 1]);
        
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function handleDel(e) {
      if (active) {
        var sel = selection();
        sel[1]>0 ? deleteRange(sel) : deleteRange([sel[0], 1]);
        
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function handleNewline(e) {
      if (!active) return;

      insertCharacter('\n', selection()[0]);
      e.preventDefault();
      e.stopPropagation();
    }


    function annotationUpdates() {
      var ops = [];
      var deletedAnnotations = [];

      _.each(dirtyNodes, function(method, key) {
        if (method === "delete") return deletedAnnotations.push(key);
        // var a = annotations[key];
        var a = annotationById(key);

        if (method === "insert") {
          ops.push(["insert", {id: a.id, type: a.type, pos: a.pos}]);
        } else if (method === "update") {
          ops.push(["update", {id: a.id, pos: a.pos}]);
        }
      });

      if (deletedAnnotations.length > 0) {
        ops.push(["delete", {"nodes": deletedAnnotations}]);
      }

      return ops;
    }

    function activateSurface(e) {
      if (pasting) return;
      active = true;
      renderAnnotations();
      Substance.Surface.activeSurface = that;
      that.trigger('surface:active', content, prevContent);
    }

    function deactivateSurface(e) {
      if (pasting) return;

      content = getContent();

      var ops = annotationUpdates();

      if (prevContent !== content || ops.length > 0) {
        dirtyNodes = {};
        that.trigger('content:changed', content, prevContent, ops);
        prevContent = content;
      }
      active = false;
      renderAnnotations();
      // Reset activeSurface reference
      Substance.Surface.activeSurface = null;
    }

    // Bind Events
    // ------

    // Backspace key
    key('backspace', handleBackspace);
    key('del', handleDel);

    key('ctrl+d', function() {
      if (!active) return;
      console.log('test', selection());
      return false;
    });

    // Enter key for new lines
    key('shift+enter', handleNewline);

    // Paste
    el.addEventListener('paste', handlePaste);

    // Inserting new characters
    el.addEventListener('keypress', handleKey);

    // Activate surface
    el.addEventListener('focus', activateSurface);

    // Deactivate surface
    el.addEventListener('blur', deactivateSurface);

    // Exposed API
    // -----------------

    this.select = select;
    this.selection = selection;
    this.annotations = annotations;
    this.getContent = getContent;
    this.deleteRange = deleteRange;
    this.insertCharacter = insertCharacter;
    this.insertText = insertText;
    this.insertAnnotation = insertAnnotation;
    this.getAnnotations = getAnnotations;
    this.deleteAnnotation = deleteAnnotation;
    this.highlight = highlight;
  };

  _.extend(Substance.Surface.prototype, _.Events);

  // Global Event Handlers
  // -----------------

  // Selection changed
  // For some reason however when switching between two editable elements
  // onselectionchange gets fired twice for the new element.

  document.onselectionchange = function(e) {
    var target = Substance.Surface.activeSurface;
    if (target) target.trigger('selection:changed', target.selection());
  };

})(window);