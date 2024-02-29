const fs = require("fs/promises");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "ports",
    description: "Shows used ports by services",
    category: "server",
    async execute(logger, client, message, args) {
        const portsTXT = await fs.readFile("netstats.txt", { encoding: "utf8" });
        const serverPages = [];
        const portsOBJ = portsToOBJ(portsTXT);

        const embed = {
            color: 0xffffff,
            title: "Ports and their associated service",
            fields: [],
            timestamp: new Date(),
        };

        // Create pages with 10 servers per page
        const fields = portsOBJ.map((server) => ({
            name: `Port: \`${server.ip}:\`**${server.port}** [${server.protocol}]`,
            value: server.service,
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

function portsToOBJ(port) {
    const JSONPorts = [];
    const lines = port.trim().split("\n");
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[6] == "-") continue;
        const ipAndPort = parts[3].split(":");
        JSONPorts.push({
            service: parts[6] + (parts[7] || ""),
            ip: ipAndPort[0],
            port: ipAndPort[1],
            protocol: parts[0],
        });
    }
    return JSONPorts;
}