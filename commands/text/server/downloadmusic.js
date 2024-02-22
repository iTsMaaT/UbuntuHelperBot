const { spawn } = require("child_process");
const { addToQueue } = require("../../../utils/QueueSystem.js");
const NodeID3 = require("node-id3");

module.exports = {
    name: "downloadmp3",
    description: "Downloads a youtube video as MP3 with metadata for Jellyfin",
    category: "server",
    aliases: ["dlmp3"],
    async execute(logger, client, message, args) {
        const videoUrl = args[0];
        if (!videoUrl) return message.reply("You must provide a valid URL");

        const outputFolder = "/mnt/jellyfin/Music";
        const downloadCommand = [
            "/home/container/yt-dlp",
            "-f",
            "bestaudio[ext=m4a]",
            "-x",
            "--audio-format",
            "mp3",
            "-o",
            `${outputFolder}/%(title)s.%(ext)s`,
            videoUrl,
        ];

        const collectMetadata = async () => {
            const metadata = {};

            // Prompts for metadata
            const prompts = [
                "Enter the title of the song:",
                "Enter the artist:",
                "Enter the album:",
                "Optionally paste the URL of the album cover (if any), or type 'skip':",
            ];

            for (const prompt of prompts) {
                await message.channel.send(prompt);
                const filter = response => !response.author.bot;
                const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });

                if (!collected || !collected.first()) 
                    return message.reply("You did not provide the required input. Cancelling download.");
                

                const content = collected.first().content.trim();
                if (prompt.toLowerCase().includes("cover") && content.toLowerCase() === "skip") 
                    metadata.coverURL = null;
                else 
                    metadata[prompt.toLowerCase().replace(/ /g, "_").replace(":", "")] = content;
                
            }

            return metadata;
        };

        const downloadOperation = () => {
            return new Promise((resolve, reject) => {
                try {
                    let realOutputFile;
                    collectMetadata().then(metadata => {
                        message.reply("Attempting download...");
        
                        const ytDlpProcess = spawn(downloadCommand[0], downloadCommand.slice(1));
                        let stdoutTimer;
        
                        ytDlpProcess.stdout.on("data", data => {
                            clearTimeout(stdoutTimer);
                            stdoutTimer = setTimeout(() => {
                                ytDlpProcess.kill();
                                reject("No stdout received for 5 minutes, process terminated.");
                            }, 5 * 60 * 1000); // 5 minutes
        
                            logger.info(`stdout: ${data}`);
                            if (`${data}`.trim().startsWith("[ExtractAudio] Destination: ")) realOutputFile = `${data}`.trim().split("[ExtractAudio] Destination: ")[1];
                        });
        
                        ytDlpProcess.stderr.on("data", data => {
                            logger.error(`stderr: ${data}`);
                            message.channel.send(`Error: ${data}`);
                        });
        
                        ytDlpProcess.on("close", code => {
                            clearTimeout(stdoutTimer);
                            if (code !== 0) {
                                logger.error(`yt-dlp process exited with code ${code}`);
                                reject(`yt-dlp process exited with code ${code}`);
                            } else {
                                // Embed metadata into the downloaded MP3 file
                                const downloadedFilePath = realOutputFile;
                                const tags = {
                                    title: metadata.title,
                                    artist: metadata.artist,
                                    album: metadata.album,
                                    APIC: metadata.coverURL ? metadata.coverURL : null,
                                };
        
                                const success = NodeID3.write(tags, downloadedFilePath);
                                if (success === true) {
                                    resolve("Video downloaded and metadata embedded successfully!");
                                } else {
                                    logger.error("Error embedding metadata:" + success);
                                    reject("Failed to embed metadata into the downloaded MP3 file.");
                                }
                            }
                        });
                    }).catch(err => {
                        logger.error(err);
                        reject("An error occurred executing the command");
                    });
                } catch (err) {
                    logger.error(err);
                    reject("An error occurred executing the command");
                }
            });
        };        

        try {
            const result = await addToQueue("download", downloadOperation);
            /*
            if (result !== undefined)
                message.reply(result);
            else
                message.reply("An error occurred during the download process.");
            */

        } catch (err) {
            message.reply(err);
        }
    },
};
