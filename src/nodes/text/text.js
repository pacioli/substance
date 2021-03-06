sc.views.Node.define('text', {

  className: 'content-node text',

  focus: function () {
    $(this.textEl).click();
  },

  select: function () {
    sc.views.Node.prototype.select.apply(this);
  },

  deselect: function () {
    sc.views.Node.prototype.deselect.apply(this);
  },

  // Deal with incoming update
  update: function() {
    // this.editor.setValue(this.model.content);
  },

  annotate: function(type) {
    var id = "annotation:"+Math.uuid();
    this.surface.insertAnnotation({ id: id, type: type, pos: this.surface.selection() });
    choreographer.trigger('comment-scope:selected', id, this.model.id, id);
  },

  initSurface: function() {
    var that = this;

    var annotations = app.view.model.document.annotations(this.model.id);

    this.surface = new Substance.Surface({
      el: this.$('.content')[0],
      content: this.model.content,
      annotations: annotations,
      types: {
        "em": {
          "inclusive": true,
          "visibility" : 'both'
        },
        "str": {
          "inclusive": true,
          "visibility" : 'both'
        },
        "idea": {
          "inclusive": false,
          "visibility" : 'both'
        },
        "blur": {
          "inclusive": false,
          "visibility" : 'both'
        },
        "doubt": {
          "inclusive": false,
          "visibility" : 'both'
        }
      }
    });

    // Events
    // ------
  
    // Hackish way to prevent node selection to be triggered two times
    this.$('.content').click(function() {
      return false;
    });

    this.surface.on('surface:active', function(sel) {
      that.session.select([that.model.id], {edit: true});
    });

    function selectionChanged(sel) {
      var marker = that.surface.getAnnotations(sel, ["idea", "blur", "doubt"])[0];
      if (marker) {
        choreographer.trigger('comment-scope:selected', marker.id, that.model.id, marker.id);
        that.surface.highlight(marker.id);
      } else {
        choreographer.trigger('comment-scope:selected', 'node_comments', that.model.id, null);
        that.surface.highlight(null);
      }
    }

    // Update comments panel according to marker context
    this.surface.off('selection:changed', selectionChanged);
    this.surface.on('selection:changed', selectionChanged);

    // This gets fired a lot on every keystroke but no longer for adding annotations
    this.surface.on('changed', function() {
      // that.session.comments.updateAnnotations(that.surface.getContent(), that.surface.annotations);
    });

    this.surface.on('annotations:changed', function() {
      that.session.comments.updateAnnotations(that.surface.getContent(), that.surface.annotations);
    });

    // Changes are confirmed.
    this.surface.on('content:changed', function(content, prevContent, ops) {

      var delta = _.extractOperation(prevContent, content);

      console.log('Partial text update', delta);

      // Update content incrementally
      if (content !== prevContent) {
        var op = ["update", {id: that.model.id, "data": delta}];
        // Does not trigger a re-render of the node
        // This only happens for operations coming from outside
        that.document.apply(op);
      }

      // console.log('annotation ops', ops);

      // Applying annotation ops...
      _.each(ops, function(op) {
        op[0] += "_annotation"; // should be done on the surface level?
        op[1].node = that.model.id;
        that.document.apply(op, {user: "michael"});
      });

      // function prettyprintAnnotations(annotations) {
      //   console.log('Annotations:');
      //   _.each(annotations, function(a) {
      //     console.log(a.type + ': ' + a.pos);
      //   });
      // }
      // prettyprintAnnotations(that.document.annotations);

      // Really? No.
      // that.session.comments.compute();
    });
  },

  render: function() {
    // console.log('rendering', this.model.id);
    sc.views.Node.prototype.render.apply(this, arguments);
    this.initSurface();
    return this;
  }
});