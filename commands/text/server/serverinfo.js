const { PrometheusDriver } = require("prometheus-query");
const prettyMilliseconds = require("pretty-ms");
const { ToEngineerNotation } = require("@functions/formattingFunctions");

module.exports = {
    name: "serverinfo",
    description: "List all pterodactyl servers",
    category: "server",
    aliases: ["si"],
    async execute(logger, client, message, args) {
        const prometheusEndpoint = "http://192.168.2.254:9090/"; // Replace with your Prometheus server endpoint

        async function fetchPrometheus(queries) {
            const queryObject = {};
            const prom = new PrometheusDriver({
                endpoint: prometheusEndpoint,
                baseURL: "/api/v1", // default value
            });
            for (const query of queries) {
                const queryResult = await prom.instantQuery(query.query);
                queryObject[query.name] = queryResult.result[0]?.value?.value ?? null;
            }
            
            return queryObject;
        }

        // Example queries
        const queries = [
            {
                name: "TotalDiskSpace",
                query: "node_filesystem_size_bytes",
            }, {
                name: "DiskUsage",
                query: "node_filesystem_free_bytes",
            }, {
                name: "CPUusagePourcentage",
                query: "sum(rate(node_cpu_seconds_total{mode='idle'}[1m])) by (instance)",
            }, { 
                name: "CPUFanRPM", 
                query:"node_hwmon_fan_rpm", 
            }, { 
                name: "MemoryUsage",
                query:"node_memory_Active_bytes", 
            }, { 
                name: "MemoryLimit",
                query:"node_memory_MemTotal_bytes", 
            }, { 
                name: "CPUTemp", 
                query:"node_hwmon_temp_celsius * on(chip) group_left(chip_name) node_hwmon_chip_names", 
            }, { 
                name: "CPUThreads", 
                query:"count without(cpu, mode) (node_cpu_seconds_total{mode='idle'})", 
            }, { 
                name: "UptimeMS", 
                query:"(node_time_seconds - node_boot_time_seconds) *1000", 
            },
        ];

        try {
            const dataObject = await fetchPrometheus(queries);
            console.log(dataObject);

            const embed = {
                color: 0xffffff,
                title: "Information about the Ubuntu server",
                fields: [
                    { name: "Endpoint", value: prometheusEndpoint },
                    { name: "Uptime", value: prettyMilliseconds(dataObject.UptimeMS) },
                    { name: "Total CPU Threads", value: dataObject.CPUThreads },
                    { name: "CPU Usage", value: (dataObject.CPUusagePourcentage).toFixed(2) + "%" },
                    { name: "CPU Temperature", value: dataObject.CPUTemp },
                    { name: "CPU Fan Speed", value: dataObject.CPUFanRPM + "RPM" },
                    { name: "Memory Usage", value: `${ToEngineerNotation(dataObject.MemoryUsage)}B / ${ToEngineerNotation(dataObject.MemoryLimit)}B (${(dataObject.MemoryUsage / dataObject.MemoryLimit * 100).toFixed(2)}%)` },
                    { name: "Disk Usage", value: `${ToEngineerNotation(parseInt(dataObject.TotalDiskSpace) - parseInt(dataObject.DiskUsage))}B / ${ToEngineerNotation(dataObject.TotalDiskSpace)}B (${((parseInt(dataObject.TotalDiskSpace) - parseInt(dataObject.DiskUsage)) / dataObject.TotalDiskSpace * 100).toFixed(2)}%)` },
                ],
                timestamp: new Date(),
            };

            message.reply({ embeds: [embed] });
        } catch (err) {
            logger.error(err);
        }

    },
};