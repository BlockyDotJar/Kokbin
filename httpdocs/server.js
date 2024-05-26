var http = require("http");
var fs = require("fs");

var uglify = require("uglify-js");
var winston = require("winston");
var connect = require("connect");
var route = require("connect-route");
var connect_st = require("st");
var connect_rate_limit = require("connect-ratelimit");

var DocumentHandler = require("./lib/document_handler");

const config = require("./config.json");

config.port = process.env.PORT || config.port;
config.host = process.env.HOST || config.host;

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

var Store = require("./lib/document_stores/file");
var preferredStore = new Store({ type: "file" });

if (config.recompressStaticAssets)
{
  var list = fs.readdirSync("./httpdocs/static");

  for (var j = 0; j < list.length; j++)
  {
    var item = list[j];

    if ((item.indexOf(".js") === item.length - 3) && (item.indexOf(".min.js") === -1))
    {
      var dest = `${item.substring(0, item.length - 3)}.min${item.substring(item.length - 3)}`;
      var orig_code = fs.readFileSync(`./httpdocs/static/${item}`, "utf8");

      fs.writeFileSync(`./httpdocs/static/${dest}`, uglify.minify(orig_code).code, "utf8");

      logger.info(`compressed ${item} into ${dest}`);
    }
  }
}

var path, data;

for (var name in config.documents)
{
  console.log(name)
  path = config.documents[name];
  data = fs.readFileSync(path, "utf8");

  logger.log("info", "loading static document", { name: name, path: path });

  if (data)
  {
    preferredStore.set(name, data, function(cb)
    {
      logger.log("debug", "loaded static document", { success: cb });
    }, true);

    continue;
  }
  
  logger.log("warn", "failed to load static document", { name: name, path: path });
}

var documentHandler = new DocumentHandler
({
  store: preferredStore,
  maxLength: config.maxLength,
  keyLength: config.keyLength
});

var app = connect();

if (config.rateLimits)
{
  config.rateLimits.end = true;

  app.use(connect_rate_limit(config.rateLimits));
}

app.use(
  route(function(router)
  {
    router.get("/raw/:id", function(request, response)
    {
      return documentHandler.handleRawGet(request, response, config);
    });

    router.head("/raw/:id", function(request, response)
    {
      return documentHandler.handleRawGet(request, response, config);
    });

    router.post("/documents", function(request, response)
    {
      return documentHandler.handlePost(request, response);
    });

    router.get("/documents/:id", function(request, response)
    {
      return documentHandler.handleGet(request, response, config);
    });

    router.head("/documents/:id", function(request, response)
    {
      return documentHandler.handleGet(request, response, config);
    });
  })
);

app.use
(
  connect_st
  (
    {
      path: `${__dirname}/static`,
      content: { maxAge: config.staticMaxAge },
      passthrough: true,
      index: false
    }
  )
);

app.use
(
  route(function(router)
  {
    router.get("/:id", function(request, _, next)
    {
      request.sturl = "/";
      next();
    });
  })
);

app.use
(
  connect_st
  (
    {
      path: `${__dirname}/static`,
      content: { maxAge: config.staticMaxAge },
      index: "index.html"
    }
  )
);

http.createServer(app).listen(config.port, config.host);

logger.info(`listening on ${config.host}:${config.port}`);
