function createKey(keyLength)
{
  const keyspace = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var text = "";

  for (var i = 0; i < keyLength; i++)
  {
    const index = Math.floor(Math.random() * keyspace.length);
    text += keyspace.charAt(index);
  }

  return text;
}

module.exports.createKey = createKey;
