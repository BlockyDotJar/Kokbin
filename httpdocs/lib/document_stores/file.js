var fs = require("fs");
var crypto = require("crypto");

var winston = require("winston");

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

var FileDocumentStore = function(options)
{
  this.basePath = options.path || "./data";
  this.expire = options.expire;
};

FileDocumentStore.md5 = function(str)
{
  var md5sum = crypto.createHash("md5");
  md5sum.update(str);

  return md5sum.digest("hex");
};

FileDocumentStore.prototype.set = function(key, data, callback, skipExpire)
{
  try
  {
    var _this = this;

    fs.mkdir(this.basePath, "700", function()
    {
      var fn = `${_this.basePath}/${FileDocumentStore.md5(key)}`;

      fs.writeFile(fn, data, "utf8", function(err)
      {
        if (err)
        {
          callback(false);
          return;
        }

        callback(true);

        if (_this.expire && !skipExpire)
        {
          logger.warn("file store cannot set expirations on keys");
        }
      });
    });
  }
  catch(err)
  {
    callback(false);
  }
};

FileDocumentStore.prototype.get = function(key, callback, skipExpire)
{
  var _this = this;
  var fn = `${this.basePath}/${FileDocumentStore.md5(key)}`;

  fs.readFile(fn, "utf8", function(err, data)
  {
    if (err)
    {
      callback(false);
      return;
    }

    callback(data);

    if (_this.expire && !skipExpire)
    {
      logger.warn("file store cannot set expirations on keys");
    }
  });
};

module.exports = FileDocumentStore;
