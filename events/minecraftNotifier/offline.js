module.exports = {
    name: "offline",
    async execute(client, logger, host, ip) {
        client.channels.cache.get(process.env.MC_LEAVE).send(`Server is now offline: ${host} (${ip})`);
    },
};