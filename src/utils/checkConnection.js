const { getCredentials } = require("./crendentialManager");

const checkServerConnection = async () => {
    try {
        

        
        const { url } = await getCredentials(['url']);

        if (!url) {
            return { status: false, message: 'server url not configured' };
        }

        const normalizedUrl = url.replace(/\/+$/, '');
        const endpointsToProbe = [
            `${normalizedUrl}/web/login`,
            `${normalizedUrl}/web/session/authenticate`,
        ];

        for (const endpoint of endpointsToProbe) {
            try {
                const response = await fetch(endpoint, {
                    method: 'GET',
                    cache: 'no-cache',
                });

                // The goal here is not to validate credentials, only to confirm
                // that the server is reachable enough to attempt the real request.
                if (
                    response.ok ||
                    [401, 403, 404, 405, 500, 502, 503, 520].includes(response.status)
                ) {
                    return {
                        status: true,
                        message: `server reachable via ${endpoint} with status ${response.status}`,
                    };
                }
            } catch (probeError) {
                // Try the next endpoint before considering the server unreachable.
            }
        }

        return { status: false, message: 'connection probe failed for configured server url' };
    } catch (error) {
        return {status: false, message:`connection error: ${error.message}`}; 
    }
};

module.exports = { checkServerConnection }