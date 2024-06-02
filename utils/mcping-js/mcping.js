const MinecraftServer = require("./lib/ping");
function ping(options) {
    const host = options.host;
    const port = options.port || 25565;
    const timeout = options.timeout || 5000;
    const server = new MinecraftServer(host, port);
    return new Promise((resolve, reject) => {
        server.ping(timeout, -1, (err, res) => {
            if (err) reject(err);
            resolve(res);
        });
    });
}

module.exports = {
    ping,
};