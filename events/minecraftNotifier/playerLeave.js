module.exports = {
    name: "playerLeave",
    async execute(client, logger, host, ip, players) {
        client.channels.cache.get(process.env.MC_LEAVE).send(`Players left on ${host} (${ip}): ${players.join(", ")}`);
    },
};