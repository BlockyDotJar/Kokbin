var winston = require("winston");
var Busboy = require("busboy");

var { createKey } = require("../lib/key_generators/random");

const format = winston.format;
const logger = winston.createLogger
(
  {
    level: "verbose",
    format: format.combine(format.colorize(), format.splat(), format.simple()),
    transports: [
      new winston.transports.Console()
    ]
  }
);

var DocumentHandler = function(options)
{
  this.keyLength = options.keyLength;
  this.maxLength = options.maxLength;
  this.store = options.store;
};

DocumentHandler.prototype.handleGet = function(request, response, config)
{
  const key = request.params.id.split(".")[0];
  const skipExpire = !!config.documents[key];

  this.store.get(key, function(ret)
  {
    if (ret)
    {
      logger.log("verbose", "retrieved document", { key: key });

      response.writeHead(200, { "Content-Type": "application/json" });

      if (request.method === "HEAD")
      {
        response.end();
        return;
      }

      response.end(JSON.stringify({ data: ret, key: key }));
      return;
    }

    logger.log("warn", "document not found", { key: key });

    response.writeHead(404, { "Content-Type": "application/json" });

    if (request.method === "HEAD")
    {
      response.end();
      return;
    }

    response.end(JSON.stringify({ message: "Document not found." }));
  }, skipExpire);
};

DocumentHandler.prototype.handleRawGet = function(request, response, config)
{
  const key = request.params.id.split(".")[0];
  const skipExpire = !!config.documents[key];

  this.store.get(key, function(ret)
  {
    if (ret)
    {
      logger.log("verbose", "retrieved raw document", { key: key });

      response.writeHead(200, { "Content-Type": "text/plain; Charset=UTF-8" });
      
      if (request.method === "HEAD")
      {
        response.end();
        return;
      }

      response.end(ret);
      return;
    }

    logger.log("warn", "raw document not found", { key: key });

    response.writeHead(404, { "Content-Type": "application/json" });

    if (request.method === "HEAD")
    {
      response.end();
      return;
    }

    response.end(JSON.stringify({ message: "Document not found." }));
  }, skipExpire);
};

DocumentHandler.prototype.handlePost = function (request, response)
{
  var _this = this;
  var buffer = "";
  var cancelled = false;

  var onSuccess = function ()
  {
    if (_this.maxLength && buffer.length > _this.maxLength)
    {
      cancelled = true;

      logger.log("warn", "document >maxLength", { maxLength: _this.maxLength });

      response.writeHead(400, { "Content-Type": "application/json" });
      response.end
      (
        JSON.stringify({ message: "Document exceeds maximum length." })
      );
      return;
    }

    _this.chooseKey(function (key)
    {
      _this.store.set(key, buffer, function (res)
      {
        if (res)
        {
          logger.log("verbose", "added document", { key: key });

          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ key: key }));
          return;
        }

        logger.verbose("error adding document");

        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ message: "Error adding document." }));
      });
    });
  };

  var ct = request.headers["Content-Type"];

  if (ct && ct.split(";")[0] === "multipart/form-data")
  {
    var busboy = new Busboy({ headers: request.headers });

    busboy.on("field", function (fieldname, val)
    {
      if (fieldname === "data")
      {
        buffer = val;
      }
    });

    busboy.on("finish", function ()
    {
      onSuccess();
    });

    request.pipe(busboy);
    return;
  }

  request.on("data", function (data)
  {
    buffer += data.toString();
  });

  request.on("end", function ()
  {
    if (cancelled)
    {
      return;
    }

    onSuccess();
  });

  request.on("error", function (error)
  {
    logger.error(`connection error: ${error.message}`);

    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "Connection error." }));

    cancelled = true;
  });
};

DocumentHandler.prototype.chooseKey = function(callback)
{
  var key = this.acceptableKey();
  var _this = this;

  this.store.get(key, function(ret)
  {
    if (ret)
    {
      _this.chooseKey(callback);
      return;
    }

    callback(key);
  }, true);
};

DocumentHandler.prototype.acceptableKey = function()
{
  return createKey(this.keyLength);
};

module.exports = DocumentHandler;