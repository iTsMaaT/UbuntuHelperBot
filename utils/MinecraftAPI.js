const express = require("express");
const { ping } = require("minecraft-protocol");

const app = express();
app.use(express.json()); // Parse JSON bodies

app.post("/", async (req, res) => {
    if (req.body.host == null) return res.status(400).json({ error: "Please provide at least 1 host" });

    try {
        await ping({ host: req.body.host, port: req.body?.port }, (response) => res.json({ response }));
    } catch (err) {
        res.status(500).json({ error: err.stack });
    }
    
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});