module.exports = {
    name: "list",
    description: "List all pterodactyl servers",
    category: "pterodactyl",
    async execute(logger, client, message, args) {
        const servers = await (await fetch(`https://${process.env.PTERODACTYL_URL}/api/client`, {
            "method": "GET",
            "headers": {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.PTERODACTYL_API_KEY}`,
            },
        })).json();

        const embed = {
            color: 0xffffff,
            title: "Servers owned by you",
            fields: [],
            timestamp: new Date(),
        };

        for (const server of servers.data.filter(srv => srv.attributes.server_owner)) 
            embed.fields.push({ name: `\`${server.attributes.identifier}\` - ${server.attributes.name} (${server.attributes.sftp_details.ip}:${server.attributes.relationships.allocations.data[0].attributes.port})`, value: server.attributes.description || "`No description`" });
        
        message.reply({ embeds: [embed] });
    },
};