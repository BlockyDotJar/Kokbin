var haste_document = function(app)
{
  this.locked = false;
  this.app = app;
};


haste_document.prototype.htmlEscape = function(s)
{
  return s.replace(/&/g, "&amp;")
    .replace(/>/g, "&gt;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
};

haste_document.prototype.load = function(key, callback, lang)
{
  var _this = this;

  $.ajax(`${_this.app.baseUrl}documents/${key}`,
  {
    type: "get",
    dataType: "json",

    success: function(res)
    {
      _this.locked = true;
      _this.key = key;
      _this.data = res.data;

      try
      {
        var high = hljs.highlightAuto(res.data);

        if (lang === "txt")
        {
          high = { value: _this.htmlEscape(res.data) };
        }
        
        if (lang)
        {
          high = hljs.highlight(lang, res.data);
        }
      }
      catch(err)
      {
        high = hljs.highlightAuto(res.data);
      }
      
      callback
      (
        {
          value: high.value,
          key: key,
          language: high.language || lang,
          lineCount: res.data.split("\n").length
        }
      );
    },

    error: function()
    {
      callback(false);
    }
  });
};

haste_document.prototype.save = function(data, callback)
{
  if (this.locked)
  {
    return false;
  }

  this.data = data;
  var _this = this;

  $.ajax(`${_this.app.baseUrl}documents`,
  {
    type: "post",
    data: data,
    dataType: "json",
    contentType: "text/plain; Charset=utf-8",

    success: function(res)
    {
      _this.locked = true;
      _this.key = res.key;

      var high = hljs.highlightAuto(data);

      callback(null,
      {
        value: high.value,
        key: res.key,
        language: high.language,
        lineCount: data.split("\n").length
      });
    },

    error: function(res)
    {
      try
      {
        callback($.parseJSON(res.responseText));
      }
      catch (e)
      {
        callback({message: "Something went wrong!"});
      }
    }
  });
};

var haste = function(appName, options)
{
  this.appName = appName;
  this.$textarea = $("textarea");
  this.$box = $("#box");
  this.$code = $("#box code");
  this.$linenos = $("#linenos");
  this.options = options;
  this.configureShortcuts();
  this.configureButtons();

  if (!options.twitter)
  {
    $("#box2 .twitter").hide();
  };

  this.baseUrl = options.baseUrl || "/";
};

haste.prototype.setTitle = function(ext)
{
  var title = ext ? `${this.appName} - ${ext}` : this.appName;

  document.title = title;
};

haste.prototype.showMessage = function(msg, cls)
{
  var msgBox = $(`<li class="${(cls || "info")}">${msg}</li>`);

  $("#messages").prepend(msgBox);

  setTimeout(function()
  {
    msgBox.slideUp("fast", function() { $(this).remove(); } );
  }, 3000);
};

haste.prototype.lightKey = function()
{
  this.configureKey( [ "new", "save" ] );
};

haste.prototype.fullKey = function()
{
  this.configureKey( [ "new", "duplicate", "twitter", "raw" ] );
};

haste.prototype.configureKey = function(enable)
{
  var $this, i = 0;

  $("#box2 .function").each(function()
  {
    $this = $(this);

    for (i = 0; i < enable.length; i++)
    {
      if ($this.hasClass(enable[i]))
      {
        $this.addClass("enabled");
        return true;
      }
    }

    $this.removeClass("enabled");
  });
};

haste.prototype.newDocument = function(hideHistory)
{
  this.$box.hide();
  this.doc = new haste_document(this);

  if (!hideHistory)
  {
    window.history.pushState(null, this.appName, this.baseUrl);
  }

  this.setTitle();
  this.lightKey();

  this.$textarea.val("").show("fast", function()
  {
    this.focus();
  });

  this.removeLineNumbers();
};

haste.extensionMap =
{
  rb: "ruby", py: "python", pl: "perl", php: "php", scala: "scala", go: "go",
  xml: "xml", html: "xml", htm: "xml", css: "css", js: "javascript", vbs: "vbscript",
  lua: "lua", pas: "delphi", java: "java", cpp: "cpp", cc: "cpp", m: "objectivec",
  vala: "vala", sql: "sql", sm: "smalltalk", lisp: "lisp", ini: "ini",
  diff: "diff", bash: "bash", sh: "bash", tex: "tex", erl: "erlang", hs: "haskell",
  md: "markdown", txt: "", coffee: "coffee", swift: "swift", kt: "kotlin", jl: "julia",
  rs: "rust", ts: "typescript", bf: "brainfuck"
};

haste.prototype.lookupExtensionByType = function(type)
{
  for (var key in haste.extensionMap)
  {
    if (haste.extensionMap[key] === type)
    {
      return key
    };
  }

  return type;
};

haste.prototype.lookupTypeByExtension = function(ext)
{
  return haste.extensionMap[ext] || ext;
};

haste.prototype.addLineNumbers = function(lineCount)
{
  var h = "";

  for (var i = 0; i < lineCount; i++)
  {
    h += (i + 1).toString() + "<br/>";
  }

  $("#linenos").html(h);
};

haste.prototype.removeLineNumbers = function()
{
  $("#linenos").html("&gt;");
};

haste.prototype.loadDocument = function(key)
{
  var parts = key.split(".", 2);
  var _this = this;

  _this.doc = new haste_document(this);

  _this.doc.load(parts[0], function(ret)
  {
    if (ret)
    {
      _this.$code.html(ret.value);
      _this.setTitle(ret.key);
      _this.fullKey();
      _this.$textarea.val("").hide();
      _this.$box.show().focus();
      _this.addLineNumbers(ret.lineCount);

      return;
    }

    _this.newDocument();
  }, this.lookupTypeByExtension(parts[1]));
};

haste.prototype.duplicateDocument = function()
{
  if (this.doc.locked)
  {
    var currentData = this.doc.data;

    this.newDocument();
    this.$textarea.val(currentData);
  }
};

haste.prototype.lockDocument = function()
{
  var _this = this;

  this.doc.save(this.$textarea.val(), function(err, ret)
  {
    if (err)
    {
      _this.showMessage(err.message, "error");
      return;
    }

    if (ret)
    {
      _this.$code.html(ret.value);
      _this.setTitle(ret.key);

      var file = _this.baseUrl + ret.key;

      if (ret.language)
      {
        file += `.${_this.lookupExtensionByType(ret.language)}`;
      }

      window.history.pushState(null, `${_this.appName}-${ret.key}`, file);

      _this.fullKey();
      _this.$textarea.val("").hide();
      _this.$box.show().focus();
      _this.addLineNumbers(ret.lineCount);
    }
  });
};

haste.prototype.configureButtons = function()
{
  var _this = this;

  this.buttons =
  [
    {
      $where: $("#box2 .save"),
      label: "Save",
      shortcutDescription: "control + s",

      shortcut: function(evt)
      {
        return evt.ctrlKey && (evt.keyCode === 83);
      },

      action: function()
      {
        if (_this.$textarea.val().replace(/^\s+|\s+$/g, "") !== "")
        {
          _this.lockDocument();
        }
      }
    },

    {
      $where: $("#box2 .new"),
      label: "New",

      shortcut: function(evt)
      {
        return evt.ctrlKey && evt.keyCode === 78;
      },

      shortcutDescription: "control + n",

      action: function()
      {
        _this.newDocument(!_this.doc.key);
      }
    },

    {
      $where: $("#box2 .duplicate"),
      label: "Duplicate & Edit",

      shortcut: function(evt)
      {
        return _this.doc.locked && evt.ctrlKey && evt.keyCode === 68;
      },

      shortcutDescription: "control + d",

      action: function()
      {
        _this.duplicateDocument();
      }
    },

    {
      $where: $("#box2 .raw"),
      label: "Just Text",

      shortcut: function(evt)
      {
        return evt.ctrlKey && evt.shiftKey && evt.keyCode === 82;
      },

      shortcutDescription: "control + shift + r",

      action: function()
      {
        window.location.href = `${_this.baseUrl}raw/${_this.doc.key}`;
      }
    },

    {
      $where: $("#box2 .twitter"),
      label: "Post on X",

      shortcut: function(evt)
      {
        return _this.options.twitter && _this.doc.locked && evt.shiftKey && evt.ctrlKey && evt.keyCode == 88;
      },

      shortcutDescription: "control + shift + x",

      action: function()
      {
        window.open(`https://x.com/intent/post?url=${encodeURI(window.location.href)}`);
      }
    }
  ];

  for (var i = 0; i < this.buttons.length; i++)
  {
    this.configureButton(this.buttons[i]);
  }
};

haste.prototype.configureButton = function(options)
{
  options.$where.click(function(evt)
  {
    evt.preventDefault();

    if (!options.clickDisabled && $(this).hasClass("enabled"))
    {
      options.action();
    }
  });

  options.$where.mouseenter(function()
  {
    $("#box3 .label").text(options.label);
    $("#box3 .shortcut").text(options.shortcutDescription || "");
    $("#box3").show();

    $(this).append($("#pointer").remove().show());
  });

  options.$where.mouseleave(function()
  {
    $("#box3").hide();
    $("#pointer").hide();
  });
};

haste.prototype.configureShortcuts = function()
{
  var _this = this;

  $(document.body).keydown(function(evt)
  {
    var button;

    for (var i = 0 ; i < _this.buttons.length; i++)
    {
      button = _this.buttons[i];

      if (button.shortcut && button.shortcut(evt))
      {
        evt.preventDefault();
        button.action();

        return;
      }
    }
  });
};

$(function()
{
  $("textarea").keydown(function(evt)
  {
    if (evt.keyCode === 9)
    {
      evt.preventDefault();

      var myValue = "  ";

      if (document.selection)
      {
        this.focus();

        var sel = document.selection.createRange();
        sel.text = myValue;

        this.focus();
        return;
      }
      
      if (this.selectionStart || this.selectionStart == "0")
      {
        var startPos = this.selectionStart;
        var endPos = this.selectionEnd;
        var scrollTop = this.scrollTop;

        this.value = this.value.substring(0, startPos) + myValue + this.value.substring(endPos,this.value.length);

        this.focus();

        this.selectionStart = startPos + myValue.length;
        this.selectionEnd = startPos + myValue.length;
        this.scrollTop = scrollTop;
        return;
      }

      this.value += myValue;

      this.focus();
    }
  });
});