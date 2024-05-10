module.exports = {
    name: "online",
    async execute(client, logger, host, ip) {
        console.log("online fired");
        client.channels.cache.get(process.env.MC_ONLINE).send(`Server is now online: ${host} (${ip})`);
    },
};