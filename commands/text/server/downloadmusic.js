const { spawn } = require("child_process");
const { addToQueue } = require("../../../utils/QueueSystem.js");
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

        const outputFolder = "/mnt/jellyfin/Music";

        const collectMetadata = async () => {
            const metadata = {};

            // Prompts for metadata
            const prompts = [
                { name: "title", prompt: "Enter the title of the song:" },
                { name: "artist", prompt: "Enter the artist:" },
                { name: "album", prompt: "Enter the album:" },
                { name: "cover", prompt: "Optionally paste the URL of the album cover (if any), or type 'skip':" },
            ];

            for (const promptObj of prompts) {
                await message.channel.send(promptObj.prompt);
                const filter = response => !response.author.bot;
                const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        
                if (!collected || !collected.first()) 
                    return message.reply("You did not provide the required input. Cancelling download.");
        
                const content = collected.first().content.trim();
                if (promptObj.name === "cover" && content.toLowerCase() === "skip") 
                    metadata.cover = null;
                else 
                    metadata[promptObj.name] = content;
            }

            return metadata;
        };

        const downloadOperation = async () => {
            try {
                const metadata = await collectMetadata();
                console.log(metadata);
                message.reply("Attempting download...");

                const downloadedFilePath = `${outputFolder}/${metadata.title} - ${metadata.artist}.mp3`;

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
                    return "Video downloaded and metadata embedded successfully!";
                } else {
                    logger.error("Error embedding metadata:" + success);
                    throw new Error("Failed to embed metadata into the downloaded MP3 file.");
                }
            } catch (err) {
                logger.error(err);
                throw new Error("An error occurred executing the command");
            }
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
            message.reply(err.message);
        }
    },
};
