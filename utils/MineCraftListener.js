const cron = require("cron");
const mcProtocol = require("minecraft-protocol");
const dns = require("dns");
const { EventEmitter } = require("node:events");
// const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Function to find added and removed elements between two arrays.
 * @param {Array} oldArray - The old array.
 * @param {Array} newArray - The new array.
 * @returns {Object} - An object containing added and removed elements.
 */
function findAddedAndRemovedElements(oldArray, newArray) {
    const lowerCaseOldArray = oldArray.map(item => item.toLowerCase());
    const lowerCaseNewArray = newArray.map(item => item.toLowerCase());

    const addedElements = newArray.filter(item => !lowerCaseOldArray.includes(item.toLowerCase()));
    const removedElements = oldArray.filter(item => !lowerCaseNewArray.includes(item.toLowerCase()));

    return {
        added: addedElements,
        removed: removedElements,
    };
}

/**
 * MinecraftNotifier class that extends EventEmitter.
 * @extends EventEmitter
 */
class MinecraftNotifier extends EventEmitter {
    /**
     * Constructs a new MinecraftNotifier.
     * @param {Array} adresses - An array of server addresses.
     * @throws Will throw an error if more than 10 IPs are provided or if there are duplicate IPs.
     */
    constructor(adresses) {
        super();
        this.adresses = adresses;
        this.playersByServer = {};
        this.adressesCheck = null;
        if (this.adresses.length > 10) throw new Error("Cannot analyse more than 10 IPs");

        const uniqueIps = new Set();
        
        for (const address of this.adresses) {
            if (uniqueIps.has(address.ip)) 
                throw new Error(`Duplicate IP found: ${address.ip}`);
            
            uniqueIps.add(address.ip);
            this.playersByServer[address.ip] = [];
        }

        for (const address of this.adresses) 
            this.playersByServer[address.ip] = [];
    }

    /**
     * Start monitoring the Minecraft servers.
     * @param {string} [time] - The cron time string. Default is "* * * * *".
     */
    start(time) {
        const formatMOTD = (description) => {
            if (typeof description === "string") {
                const descLines = description.split("\n");
                for (let i = 0; i < descLines.length; i++) 
                    descLines[i] = descLines[i].trim();
                
                description = descLines.join("\n").replace(/§[0-9a-fklmnor]/g, "");
                return description;
            } else if (description?.extra) {
                const formattedDesc = [];
                for (const textObj of description.extra) 
                    formattedDesc.push(textObj.text.replace(/\n/g, ""));
        
                return formattedDesc.join("\n");
            } else {
                return null;
            }
        };

        this.adressesCheck = new cron.CronJob(time ?? "* * * * *", async () => {
            this.emit("check", time ?? "* * * * *", Date.now());
            const oldState = { ...this.playersByServer };

            for (const address of this.adresses) {
                if (!address.port) address.port = null;
                let currentInfo;
                try {
                    currentInfo = await (await fetch("http://localhost:3000", { 
                        body: JSON.stringify({
                            host: address.ip,
                            port: address.port,
                        }),
                        headers: {
                            "Content-Type": "application/json",
                        },
                        method: "POST",
                        signal: AbortSignal.timeout(5000),
                    })).json();

                    console.log(currentInfo);
                    currentInfo.online = true;
                } catch (err) {
                    logger.error(err);
                    currentInfo = { online: false };
                }

                this.playersByServer[address.ip] = {
                    online: true,
                    playerList: currentInfo?.players?.sample?.map(player => player.name) ?? [],
                    playerOnline: currentInfo?.players?.online,
                    playerLimit: currentInfo?.players?.max,
                    ip_address: await dns.promises.resolve(address.ip, "A").then(addresses => addresses[0]).catch(() => null),
                    port: address?.port ?? "25565",
                    version: currentInfo?.version?.protocol,
                    motd: formatMOTD(currentInfo?.description),
                    icon: currentInfo?.favicon,
                };

                console.log(this.playersByServer[address.ip]);

                this.emit("singleServerCheck", address.ip, this.playersByServer[address.ip]);

                if (!oldState[address.ip]) continue;

                if (!oldState[address.ip].online && this.playersByServer[address.ip].online) 
                    this.emit("online", address.ip, this.playersByServer[address.ip].ip_address);

                if (oldState[address.ip].online && !this.playersByServer[address.ip].online) 
                    this.emit("offline", address.ip, this.playersByServer[address.ip].ip_address);

                if (!oldState[address.ip].online || !this.playersByServer[address.ip].online || 
                    this.playersByServer[address.ip].eula_blocked) continue;

                if (oldState[address.ip].playerOnline !== this.playersByServer[address.ip].playerOnline) 
                    this.emit("playerOnlineUpdate", address.ip, this.playersByServer[address.ip].ip_address, oldState[address.ip].playerOnline, this.playersByServer[address.ip].playerOnline);

                if (oldState[address.ip].playerLimit !== this.playersByServer[address.ip].playerLimit) 
                    this.emit("playerLimitUpdate", address.ip, this.playersByServer[address.ip].ip_address, oldState[address.ip].playerLimit, this.playersByServer[address.ip].playerLimit);

                if (oldState[address.ip].ip_address !== this.playersByServer[address.ip].ip_address) 
                    this.emit("IPAdressUpdate", address.ip, oldState[address.ip].ip_address, this.playersByServer[address.ip].ip_address);

                if (oldState[address.ip].version !== this.playersByServer[address.ip].version) 
                    this.emit("protocolUpdate", address.ip, this.playersByServer[address.ip].ip_address, oldState[address.ip].version, this.playersByServer[address.ip].version);

                if (oldState[address.ip].motd !== this.playersByServer[address.ip].motd) 
                    this.emit("motdUpdate", address.ip, this.playersByServer[address.ip].ip_address, oldState[address.ip].motd, this.playersByServer[address.ip].motd);

                if (oldState[address.ip].icon !== this.playersByServer[address.ip].icon) 
                    this.emit("iconUpdate", address.ip, this.playersByServer[address.ip].ip_address, oldState[address.ip].icon, this.playersByServer[address.ip].icon);

                if (oldState[address.ip].software !== this.playersByServer[address.ip].software) 
                    this.emit("softwareUpdate", address.ip, this.playersByServer[address.ip].ip_address, oldState[address.ip].software, this.playersByServer[address.ip].software);


                const playerChanges = findAddedAndRemovedElements(oldState[address.ip].playerList ?? [], this.playersByServer[address.ip].playerList);


                if (playerChanges.added.length) this.emit("playerJoin", address.ip, this.playersByServer[address.ip].ip_address, playerChanges.added);
                if (playerChanges.removed.length) this.emit("playerLeave", address.ip, this.playersByServer[address.ip].ip_address, playerChanges.removed);

                await wait(1000);
            }
        });
        console.log("cron start");
        this.adressesCheck.start();
    }

    /**
     * Get the singleton instance of MinecraftNotifier.
     * @param {Array} adresses - An array of server addresses.
     * @returns {MinecraftNotifier} - The singleton instance of MinecraftNotifier.
     */
    static getInstance(adresses) {
        if (!MinecraftNotifier.instance) 
            MinecraftNotifier.instance = new MinecraftNotifier(adresses);
        
        return MinecraftNotifier.instance;
    }
    
    /**
     * Stop monitoring the Minecraft servers.
     */
    stop() {
        if (this.adressesCheck) {
            this.adressesCheck.stop();
            this.adressesCheck = null;
        }
    }

    /**
     * Get UUID by username.
     * @param {string} username - The username.
     * @returns {Promise<string>} - The UUID.
     * @throws Will throw an error if the username is not provided or if there's an error from the API.
     */
    async getUUIDbyUsername(username) {
        if (!username) throw new Error("A username must be provided");
        const UUID = await (await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)).json();
        if (UUID.errorMessage) throw new Error(UUID.errorMessage);
        return UUID.id;
    }

    /**
     * Get Minecraft version by protocol version.
     * @param {number} protocol - The protocol version.
     * @returns {Array} - An array of Minecraft versions.
     * @throws Will throw an error if the protocol version is not provided.
     */
    getVersionByProtocol(protocol) {
        if (!protocol) throw new Error("A protocol version must be provided");
        const versions = {
            766: ["1.20.5"],
            765: ["1.20.3", "1.20.4"],
            764: ["1.20.2"],
            763: ["1.20.1"],
            762: ["1.20.0"],
            761: ["1.19.4"],
            760: ["1.19.3"],
            759: ["1.19.1", "1.19.2"],
            758: ["1.19.0"],
            757: ["1.18.2"],
            756: ["1.18.1"],
            755: ["1.18.0"],
            754: ["1.17.1"],
            753: ["1.17.0"],
            752: ["1.16.5"],
            751: ["1.16.4"],
            750: ["1.16.3"],
            749: ["1.16.2"],
            748: ["1.16.1"],
            747: ["1.16.0"],
            578: ["1.15.2"],
            575: ["1.15.1"],
            573: ["1.15.0"],
            498: ["1.14.4"],
            490: ["1.14.3"],
            485: ["1.14.2"],
            480: ["1.14.1"],
            477: ["1.14.0"],
            404: ["1.13.2"],
            401: ["1.13.1"],
            393: ["1.13.0"],
            340: ["1.12.2"],
            338: ["1.12.1"],
            335: ["1.12.0"],
            316: ["1.11.1", "1.11.2"],
            315: ["1.11.0"],
            210: ["1.10.0", "1.10.1", "1.10.2"],
            110: ["1.9.4"],
            109: ["1.9.3"],
            108: ["1.9.1"],
            107: ["1.9.0"],
            47: ["1.8.0", "1.8.1", "1.8.2", "1.8.3", "1.8.4", "1.8.5", "1.8.6", "1.8.7", "1.8.8", "1.8.9"],
            5: ["1.7.6", "1.7.7", "1.7.8", "1.7.9", "1.7.10"],
            4: ["1.7.2", "1.7.3", "1.7.4", "1.7.5"],
        };
        return versions[protocol] ?? null;
    }

    /**
     * Get raw API response from mcstatus.io.
     * @param {string} host - The host or IP.
     * @param {number} [port] - The port.
     * @returns {Promise<Object>} - The API response.
     * @throws Will throw an error if the host or IP is not provided.
     */
    async getRawAPIResponse(host, port) {
        if (!host) throw new Error("A host or IP must be provided");
        return await (await fetch(`https://api.mcstatus.io/v2/status/java/${host}${port ? `:${port}` : ""}`)).json();
    }
}

module.exports = MinecraftNotifier;