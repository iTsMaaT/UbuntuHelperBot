const fs = require("fs/promises");
const NodeID3 = require("node-id3");
const youtubeDlExec = require("youtube-dl-exec");

module.exports = {
    name: "downloadmp3",
    description: "Downloads a youtube video as MP3 with metadata for Jellyfin",
    category: "server",
    aliases: ["dlmp3"],
    async execute(logger, client, message, args) {
        const videoUrl = args[0];
        if (!videoUrl) return message.reply("You must provide a valid URL");

        const outputFolderBusy = "/mnt/jellyfin/Music/Busy";
        const outputFolderCompleted = "/mnt/jellyfin/Music/Completed";

        const collectMetadata = async () => {
            const metadata = {};
            const prompts = [
                { name: "title", prompt: "Enter the title of the song:" },
                { name: "artist", prompt: "Enter the artist:" },
                { name: "album", prompt: "Enter the album:" },
                { name: "cover", prompt: "Optionally paste the URL of the album cover (if any), or type 'skip':" },
            ];

            for (const promptObj of prompts) {
                const promptMessage = await message.channel.send(promptObj.prompt);
                const filter = response => !response.author.bot;
                const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });

                if (!collected || !collected.first()) 
                    return message.reply("You did not provide the required input. Cancelling download.");
                
                
                const content = collected.first().content.trim();
                await promptMessage.delete();
                await collected.first().delete();

                if (promptObj.name === "cover") {
                    if (content == "skip") {
                        metadata.cover = null;
                    } else {
                        try {
                            const response = await (await fetch(content)).arrayBuffer();
                            metadata.cover = response;
                        } catch (error) {
                            return message.reply(`Error fetching cover image: ${error.message}`);
                        }
                    }
                    
                } else {
                    metadata[promptObj.name] = content;
                }
                
            }
            const embed = {
                color: 0xffffff,
                title: "Metadata that will be applied",
                fields:[
                    { name: "Title", value: metadata.title },
                    { name: "Artist", value: metadata.artist },
                    { name: "Album", value: metadata.album },
                    { name: "Cover image?", value: metadata.cover ? "Yes" : "No" },
                ],
                timestamp: new Date(),
            };
            message.reply({ embeds: [embed] });

            return metadata;
        };

        try {
            const metadata = await collectMetadata();
            console.log(metadata);
            message.reply("Attempting download...");

            const downloadedFilePath = `${outputFolderBusy}/${metadata.title} - ${metadata.artist}.mp3`;

            await youtubeDlExec(videoUrl, {
                extractAudio: true,
                audioFormat: "mp3",
                output: downloadedFilePath,
            });

            const tags = {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                APIC: metadata.coverURL ? metadata.coverURL : null,
            };

            const success = NodeID3.write(tags, downloadedFilePath);
            if (success === true) {
                message.reply("Video downloaded and metadata embedded successfully!");
                await fs.rename(downloadedFilePath, `${outputFolderCompleted}/${metadata.title} - ${metadata.artist}.mp3`);
            } else {
                logger.error("Error embedding metadata:" + success);
                message.reply("Failed to embed metadata into the downloaded MP3 file.");
            }
        } catch (err) {
            logger.error(err);
            message.reply("An error occurred executing the command");
        }
    },
};
