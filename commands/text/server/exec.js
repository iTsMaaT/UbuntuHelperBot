const util = require("util");
const { exec } = require("node:child_process");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "exec",
    description: "Executes a command",
    category: "server",
    async execute(logger, client, message, args) {
        let result = "";
        let success = false;
        let embed;
        const serverPages = [];
        const command = args.join(" ");
        await exec(command, { maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
            result = stdout;
            success = true;
            if (error) result = error;
            if (stderr) result = stderr; 
            if (error || stderr) success = false;
        
            console.log(result);

            if (success) {
                embed = {
                    color: 0xffffff,
                    title: `Output for command [\`${command}\`]`,
                    description: "",
                    timestamp: new Date(),
                };
            } else {
                embed = {
                    color: 0xff0000,
                    title: `Error occured while executing [\`${command}\`]`,
                    description: "",
                    timestamp: new Date(),
                };
            }

            // Create pages with 10 servers per page
            const lines = result.split("\n");

            for (let i = 0; i < lines.length; i += 20) {
                const chunk = lines.slice(i, i + 20);
                serverPages.push(chunk);
            }
            console.log(serverPages);

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

            embed.description = `\`\`\`${serverPages[currentPage].join("\n")}\`\`\``;

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

                embed.description = `\`\`\`${serverPages[currentPage].join("\n")}\`\`\``;

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
        });
    },
};