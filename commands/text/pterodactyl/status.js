const WebSocket = require("ws");
const GetPterodactylInfo = require("@functions/GetPterodactylInfo.js");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "status",
    description: "Gives the status of a server",
    category: "pterodactyl",
    async execute(logger, client, message, args) {
        const pingResult = await PowerEmbed(args[0]);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("start")
                    .setLabel("Start")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("restart")
                    .setLabel("Restart")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("stop")
                    .setLabel("Stop")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId("terminate")
                    .setLabel("Terminate")
                    .setStyle(ButtonStyle.Danger),
            );

        await message.reply({ embeds: [pingResult.embed], components: pingResult.result !== "error" ? [row] : null });
        if (pingResult.result === "error") return;

        try {
            const filter = (interaction) => interaction.isButton() && interaction.user.id === message.author.id;
            let interaction;
            try {
                interaction = await message.awaitMessageComponent({ filter, time: 60000, max: 1 });
            } catch (err) {
                try {
                    row.components.forEach(component => {
                        component.setDisabled(true);
                    });
                } catch (err) {
                    logger.error(err);
                    await message.reply("An error occurred while processing your request.");
                    return;
                }
            }

            let signal;
            switch (interaction.customId) {
                case "start":
                case "restart":
                case "stop":
                case "terminate":
                    signal = interaction.customId;
                    break;
                default:
                    signal = null;
                    break;
            }

            if (signal) {
                const desiredState = getDesiredState(signal);
                if (pingResult.result !== desiredState) 
                    await changeServerState(message, args[0], signal, row, desiredState);
                else 
                    await message.edit({ content: "The server is already in the desired state." });
                
            }
        } catch (error) {
            logger.error(error);
            await message.reply("An error occurred while processing your request.");
        }
    },
};

async function changeServerState(message, identifier, signal, row, desiredState) {
    const power = await fetch(`https://${process.env.PTERODACTYL_URL}/api/client/servers/${identifier}/power`, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.PTERODACTYL_API_KEY}`,
        },
        body: JSON.stringify({ signal }),
    });

    if (power.status !== 204) {
        const embed = {
            title: "An error occurred while changing the server state",
            color: 0xff0000,
            timestamp: new Date(),
        };

        row.components.forEach(component => {
            component.setDisabled(true);
        });

        await message.edit({ embeds: [embed], components: [row] });
    } else {
        const embed = {
            title: `The **${signal}** power action was successfully sent to the server`,
            color: 0x00ff00,
            timestamp: new Date(),
        };

        row.components.forEach(component => {
            component.setDisabled(true);
        });

        await message.edit({ embeds: [embed], components: [row] });
        await listenWebsocketForServer(message, identifier, desiredState);
    }
}

function getDesiredState(signal) {
    switch (signal) {
        case "start":
        case "restart":
            return "running";
        case "stop":
        case "terminate":
            return "offline";
        default:
            return "";
    }
}

async function listenWebsocketForServer(message, identifier, desiredState, serverName) {
    let token = await getWebsocketToken(identifier);

    const authMsg = (tkn) => {
        const msg = {
            event: "auth",
            args: [tkn],
        };
        return msg;
    };
    const ws = new WebSocket(token.data.socket, { origin: process.env.PTERODACTYL_URL });

    ws.on("open", () => {
        ws.send(JSON.stringify(authMsg(token.data.token)));
    });

    ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event == "status") {
            const newStatus = msg.args[0];
            const embed = {
                title: `Pterodactyl Info for [${identifier}] (Trying to get to a **${desiredState}** state)`,
                color: 0xffffff,
                description: `Server Status: **${newStatus}**`,
            };

            if (newStatus == desiredState) {
                ws.close();
                return message.edit({ embeds: [(await PowerEmbed(identifier)).embed] });
            }
            message.edit({ embeds: [embed] });

        } else if (msg.event == "token expiring") {
            getWebsocketToken(identifier).then(res => {
                token = res;
                ws.send(JSON.stringify(authMsg(res.data.token)));
            });
        }
    });
}

async function PowerEmbed(server) {
    let PteroInfo;
    let embed;
    let result;
    let serverName;
    try {
        PteroInfo = await GetPterodactylInfo(server);
        const substatus = [
            PteroInfo.main.status.isTransferring ? "Transferring" : null,
            PteroInfo.main.status.isInstalling ? "Installing" : null,
            PteroInfo.main.status.isSuspended ? "Suspended" : null,
        ].filter(Boolean).join(", ") || "None";

        if (PteroInfo.status === "running") {
            embed = {
                title: `Pterodactyl Info for [${server}] ${PteroInfo.main.name}`,
                color: 0xffffff,
                description: `Server Status: **${PteroInfo.status}**\nUptime: **${PteroInfo.uptime.clean}**\nSubstatus: **${substatus}**`,
                fields: [
                    {
                        name: "RAM Usage",
                        value: `${PteroInfo.ram.usage.clean} / ${PteroInfo.ram.limit.clean} (${PteroInfo.ram.percentage.clean})`,
                    }, {
                        name: "CPU Usage",
                        value: `${PteroInfo.cpu.usage}% / ${PteroInfo.cpu.limit}% (${PteroInfo.cpu.percentage.clean} or ${PteroInfo.cpu.cores} cores)`,
                    }, {
                        name: "Disk Usage",
                        value: `${PteroInfo.disk.usage.clean} / ${PteroInfo.disk.limit.clean} (${PteroInfo.disk.percentage.clean})`,
                    }, {
                        name: "Network Usage",
                        value: `IN: ${PteroInfo.network.download.clean}\nOUT: ${PteroInfo.network.upload.clean}`,
                    },
                ],
                footer: {
                    text: `Node: ${PteroInfo.main.node} | IP: ${PteroInfo.main.ip} | Port: ${PteroInfo.main.port}`,
                },
                timestamp: new Date(),
            };
        } else {
            embed = {
                title: `Pterodactyl Info for [${server}] ${PteroInfo.main.name}`,
                color: 0xffffff,
                description: `Server Status: **${PteroInfo.status}**\nSubstatus: **${substatus}**`,
                fields: [
                    {
                        name: "Server Identifier",
                        value: PteroInfo.main.identifier,
                    },
                    {
                        name: "Node",
                        value: PteroInfo.main.node,
                    },
                    {
                        name: "IP Address",
                        value: `${PteroInfo.main.ip}:${PteroInfo.main.port}`,
                    },
                ],
                footer: {
                    text: PteroInfo.main.isNodeUnderMaintenance ? "Node Under Maintenance" : "",
                },
                timestamp: new Date(),
            };
        }
        result = PteroInfo.status;
        serverName = PteroInfo.main.name;
    } catch (err) {
        embed = {
            title: "Server doesn't exist or an error occurred",
            color: 0xff0000,
            description: err.message,
            timestamp: new Date(),
        };
        result = "error";
    }
    return { embed, result, serverName };
}
