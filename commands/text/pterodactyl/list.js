const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "list",
    description: "List all pterodactyl servers",
    category: "pterodactyl",
    async execute(logger, client, message, args) {
        const servers = await (await fetch(`https://${process.env.PTERODACTYL_URL}/api/client`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.PTERODACTYL_API_KEY}`,
            },
        })).json();

        const serverPages = [];
        const selfServers = servers.data.filter(srv => srv.attributes.server_owner);
        const remainingServers = servers.data.filter(srv => !srv.attributes.server_owner);
        const allServers = [...selfServers, ...remainingServers];

        const embed = {
            color: 0xffffff,
            title: `Servers you have access to (First ${selfServers.length} owned)`,
            fields: [],
            timestamp: new Date(),
        };

        // Create pages with 10 servers per page
        const fields = allServers.map((server, index) => ({
            name: `${index + 1} - [\`${server.attributes.identifier}\`] - ${server.attributes.name} (${server.attributes.sftp_details.ip}:${server.attributes.relationships.allocations.data[0].attributes.port})`,
            value: server.attributes.description || "`No description`",
        }));

        for (let i = 0; i < fields.length; i += 10) {
            const chunk = fields.slice(i, i + 10);
            serverPages.push(chunk);
        }

        let currentPage = 0;

        // Buttons for pagination
        const firstButton = new ButtonBuilder()
            .setCustomId("first")
            .setLabel("◀◀")
            .setStyle(ButtonStyle.Success);

        const lastButton = new ButtonBuilder()
            .setCustomId("last")
            .setLabel("▶▶")
            .setStyle(ButtonStyle.Success);

        const nextButton = new ButtonBuilder()
            .setCustomId("next")
            .setLabel("▶")
            .setStyle(ButtonStyle.Primary);

        const previousButton = new ButtonBuilder()
            .setCustomId("previous")
            .setLabel("◀")
            .setStyle(ButtonStyle.Primary);

        const pageNumberButton = new ButtonBuilder()
            .setCustomId("page")
            .setLabel(`${currentPage + 1}/${serverPages.length}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        const row = new ActionRowBuilder()
            .addComponents(firstButton, previousButton, pageNumberButton, nextButton, lastButton);

        const updatePageNumber = () => {
            row.components[2].setLabel(`${currentPage + 1}/${serverPages.length}`);
        };

        const updateButtons = () => {
            row.components[0].setDisabled(currentPage === 0);
            row.components[1].setDisabled(currentPage === 0);
            row.components[3].setDisabled(currentPage === serverPages.length - 1);
            row.components[4].setDisabled(currentPage === serverPages.length - 1);
        };

        updateButtons();

        embed.fields = serverPages[currentPage];

        const sentMessage = await message.reply({
            embeds: [embed],
            components: [row],
        });

        const collector = sentMessage.createMessageComponentCollector({
            filter: interaction => interaction.user.id === message.author.id,
            time: 120000,
            dispose: true,
        });

        collector.on("collect", async interaction => {
            switch (interaction.customId) {
                case "first":
                    currentPage = 0;
                    break;
                case "previous":
                    currentPage--;
                    break;
                case "next":
                    currentPage++;
                    break;
                case "last":
                    currentPage = serverPages.length - 1;
                    break;
            }

            if (currentPage < 0) currentPage = 0;
            if (currentPage >= serverPages.length) currentPage = serverPages.length - 1;

            updatePageNumber();
            updateButtons();

            embed.fields = serverPages[currentPage];

            await interaction.update({
                embeds: [embed],
                components: [row],
            });
        });

        collector.on("end", async () => {
            row.components.forEach(component => {
                component.setDisabled(true);
            });

            await sentMessage.edit({
                embeds: [embed],
                components: [row],
            });
        });
    },
};
