const { ToEngineerNotation } = require("@functions/formattingFunctions");
const prettyMilliseconds = require("pretty-ms");

const GetPterodactylInfo = async function(serverID) {
    let serverInfo = {};
    let resourcesInfo = {};

    try {
        [serverInfo, resourcesInfo] = await Promise.all([
            fetch(`https://${process.env.PTERODACTYL_URL}/api/client/servers/${serverID}`, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                },
            }).then(res => res.json()),
            fetch(`https://${process.env.PTERODACTYL_URL}/api/client/servers/${serverID}/resources`, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                },
            }).then(res => res.json()),
        ]);
    } catch (err) {
        console.error(err.stack);
        throw new Error("An error occurred while fetching the server information");
    }

    const {
        attributes: {
            name: serverName,
            description: serverDescription,
            limits: { memory: RAMlimit, swap: swapLimit, disk: DISKlimit, io: IOlimit, cpu: CPUlimit },
            relationships: {
                allocations: {
                    data: [{ attributes: { ip_alias: IPalias, port: IPport } }],
                },
            },
            identifier: serverIdentifier,
            internal_id: internalID,
            uuid: serverUUID,
            node: serverNode,
            is_node_under_maintenance: isNodeUnderMaintenance,
            sftp_details: { ip: sftpIP, port: sftpPort },
            invocation: serverInvocation,
            docker_image: dockerImage,
            egg_features: eggFeatures,
            feature_limits: { databases: dbLimit, allocations: allocLimit, backups: backupLimit },
            is_suspended: isSuspended,
            is_installing: isInstalling,
            is_transferring: isTransferring,
        },
    } = serverInfo;

    const {
        attributes: {
            current_state: serverStatus,
            resources: {
                memory_bytes: RAMusage,
                cpu_absolute: CPUusage,
                disk_bytes: DISKusage,
                network_rx_bytes: NETWORKin,
                network_tx_bytes: NETWORKout,
                uptime: BOTuptime,
            } = {},
        } = {},
    } = resourcesInfo;

    if (serverStatus !== "running") {
        return {
            status: serverStatus,
            main: {
                name: serverName,
                description: serverDescription,
                identifier: serverIdentifier,
                internalID: internalID,
                uuid: serverUUID,
                node: serverNode,
                isNodeUnderMaintenance: isNodeUnderMaintenance,
                sftp: {
                    ip: sftpIP,
                    port: sftpPort,
                },
                invocation: serverInvocation,
                dockerImage: dockerImage,
                eggFeatures: eggFeatures,
                featureLimits: {
                    databases: dbLimit,
                    allocations: allocLimit,
                    backups: backupLimit,
                },
                status: {
                    isSuspended: isSuspended,
                    isInstalling: isInstalling,
                    isTransferring: isTransferring,
                },
                ip: IPalias,
                port: IPport,
            },
        };
    }

    const RAMlimitBytes = RAMlimit * 1024 * 1024;
    const DISKlimitBytes = DISKlimit * 1024 * 1024;

    const info = {
        status: serverStatus,
        ram: {
            limit: {
                raw: RAMlimitBytes,
                clean: `${ToEngineerNotation(RAMlimitBytes)}b`,
            },
            usage: {
                raw: RAMusage,
                clean: `${ToEngineerNotation(RAMusage)}b`,
            },
            percentage: {
                raw: (RAMusage / RAMlimitBytes) * 100,
                clean: ((RAMusage / RAMlimitBytes) * 100).toFixed(2) + "%",
            },
        },
        disk: {
            limit: {
                raw: DISKlimitBytes,
                clean: `${ToEngineerNotation(DISKlimitBytes)}b`,
            },
            usage: {
                raw: DISKusage,
                clean: `${ToEngineerNotation(DISKusage)}b`,
            },
            percentage: {
                raw: (DISKusage / DISKlimitBytes) * 100,
                clean: ((DISKusage / DISKlimitBytes) * 100).toFixed(2) + "%",
            },
        },
        cpu: {
            limit: CPUlimit,
            usage: CPUusage,
            percentage: {
                raw: (CPUusage / CPUlimit) * 100,
                clean: ((CPUusage / CPUlimit) * 100).toFixed(2) + "%",
            },
            cores: (CPUusage / 100).toFixed(2),
            absolute: {
                raw: CPUusage,
                clean: `${CPUusage.toFixed(2)}%`,
            },
        },
        network: {
            download: {
                raw: NETWORKin,
                clean: `${ToEngineerNotation(NETWORKin)}b`,
            },
            upload: {
                raw: NETWORKout,
                clean: `${ToEngineerNotation(NETWORKout)}b`,
            },
        },
        uptime: {
            raw: BOTuptime,
            clean: prettyMilliseconds(BOTuptime),
        },
        main: {
            name: serverName,
            description: serverDescription,
            identifier: serverIdentifier,
            internalID: internalID,
            uuid: serverUUID,
            node: serverNode,
            isNodeUnderMaintenance: isNodeUnderMaintenance,
            sftp: {
                ip: sftpIP,
                port: sftpPort,
            },
            invocation: serverInvocation,
            dockerImage: dockerImage,
            eggFeatures: eggFeatures,
            featureLimits: {
                databases: dbLimit,
                allocations: allocLimit,
                backups: backupLimit,
            },
            status: {
                isSuspended: isSuspended,
                isInstalling: isInstalling,
                isTransferring: isTransferring,
            },
            ip: IPalias,
            port: IPport,
        },
    };

    return info;
};

module.exports = GetPterodactylInfo;
