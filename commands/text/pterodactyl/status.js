const GetPterodactylInfo = require("@functions/GetPterodactylInfo.js");

module.exports = {
    name: "status",
    description: "Gives the status of a server",
    category: "pterodactyl",
    async execute(logger, client, message, args) {
        console.log(require("@functions/GetPterodactylInfo.js"));
        let PteroInfo;
        let embed;
        try {
            PteroInfo = await GetPterodactylInfo(args[0]);
            if (PteroInfo.status == "running") {
                embed = {
                    title: `Pterodactyl info for [\`${args[0]}\`] ${PteroInfo.main.name}`,
                    color: 0xffffff,
                    description: `Uptime: ${PteroInfo.uptime.clean}`,
                    fields: [
                        {
                            name: "RAM usage",
                            value: `${PteroInfo.ram.usage.clean} / ${PteroInfo.ram.limit.clean} (${PteroInfo.ram.pourcentage.clean})`,
                        }, {
                            name: "CPU usage (100% = 1 core)",
                            value: `${PteroInfo.cpu.usage}% / ${PteroInfo.cpu.limit}% (${PteroInfo.cpu.pourcentage.clean} or ${PteroInfo.cpu.cores} cores)`,
                        }, {
                            name: "Disk usage",
                            value: `${PteroInfo.disk.usage.clean} / ${PteroInfo.disk.limit.clean} (${PteroInfo.disk.pourcentage.clean})`,
                        }, {
                            name: "Network",
                            value: `IN: ${PteroInfo.network.download.clean}\nOUT: ${PteroInfo.network.upload.clean}`,
                        },
                    ],
                    footer: {
                        text: "",
                    },
                    timestamp: new Date(),
                };
            } else {
                embed = {
                    title: `Pterodactyl info for [\`${args[0]}\`] ${PteroInfo.main.name}`,
                    color: 0xffffff,
                    description: "Server: " + PteroInfo.status,
                    timestamp: new Date(),
                };
            }
        } catch (err) {
            embed = {
                title: "Server doesnt exist or an error occured",
                color: 0xffffff,
                timestamp: new Date(),
            };
            logger.error(err);
        }
        message.reply({ embeds: [embed] });
    },
};