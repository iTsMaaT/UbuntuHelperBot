module.exports = {
    name: "playerJoin",
    async execute(client, logger, host, ip, players) {
        client.channels.cache.get(process.env.MC_JOIN).send(`Players joined on ${host} (${ip}): ${players.join(", ")}`);
    },
};