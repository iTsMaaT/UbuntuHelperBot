const { PrometheusDriver } = require("prometheus-query");
const prettyMilliseconds = require("pretty-ms");

module.exports = {
    name: "serverinfo",
    description: "List all pterodactyl servers",
    category: "server",
    async execute(logger, client, message, args) {
        const prometheusEndpoint = "http://192.168.2.254:9090/"; // Replace with your Prometheus server endpoint

        async function fetchPrometheus(query) {
            
            const prom = new PrometheusDriver({
                endpoint: prometheusEndpoint,
                baseURL: "/api/v1", // default value
            });
            
            const queryResult = await prom.instantQuery(query);
            return queryResult;
        }

        // Example queries
        const queries = [
            { 
                name: "CPUFanRPM", 
                query:"node_hwmon_fan_rpm", 
            }, { 
                name: "MemoryPourcentage",
                query:"node_memory_Active_bytes/node_memory_MemTotal_bytes*100", 
            }, { 
                name: "CPUTemp", 
                query:"node_hwmon_temp_celsius * on(chip) group_left(chip_name) node_hwmon_chip_names", 
            }, { 
                name: "CPUThreads", 
                query:"count without(cpu, mode) (node_cpu_seconds_total{mode='idle'})", 
            }, { 
                name: "Uptime", 
                query:"node_time_seconds - node_boot_time_seconds", 
            },
        ];

        async function fetchData() {
            for (const query of queries) {
                try {
                    const result = await fetchPrometheus(query);
                    console.log(result.result[0].value.value);
                } catch (error) {
                    console.error(error);
                }
                break;
            }
        }

        fetchData();

    },
};