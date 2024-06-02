module.exports = {
    name: "playerOnlineUpdate",
    async execute(client, logger, host, ip, oldCount, newCount) {
        client.channels.cache.get(process.env.MC_MEMBER_NUMBER_UPDATE).send(`Player update on ${host} (${ip}): from ${oldCount} to ${newCount}`);
    },
};