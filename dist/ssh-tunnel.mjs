import { Client } from "ssh2";
import { logger } from "./logger.mjs";
import net from "net";
class SSHTunnelManager {
    sshClient = null;
    localServer = null;
    config;
    constructor(config) {
        this.config = config;
    }
    async createTunnel() {
        return new Promise(async (resolve, reject) => {
            try {
                // First, establish SSH connection
                await this.connectSSH();
                // Then create local port forwarding
                await this.createLocalPortForward();
                logger.logMessage("SSH tunnel established: localhost:%d -> %s:%d", this.config.localPort, this.config.remoteHost, this.config.remotePort);
                resolve();
            }
            catch (err) {
                logger.logError("SSH tunnel setup error", err);
                reject(err);
            }
        });
    }
    connectSSH() {
        return new Promise((resolve, reject) => {
            this.sshClient = new Client();
            this.sshClient.on("ready", () => {
                logger.logMessage("SSH connection established to %s:%d", this.config.host, this.config.port);
                resolve();
            });
            this.sshClient.on("error", (err) => {
                logger.logError("SSH connection error", err);
                reject(err);
            });
            this.sshClient.on("close", () => {
                logger.logMessage("SSH connection closed");
            });
            // Connect to SSH server
            const sshConfig = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
            };
            if (this.config.password) {
                sshConfig.password = this.config.password;
            }
            else if (this.config.privateKey) {
                // Format private key properly - restore line breaks if missing
                let formattedPrivateKey = this.config.privateKey;
                // Check if the key already has proper line breaks
                if (!formattedPrivateKey.includes("\n")) {
                    // Add line breaks every 64 characters for proper PEM format
                    const header = "-----BEGIN OPENSSH PRIVATE KEY-----";
                    const footer = "-----END OPENSSH PRIVATE KEY-----";
                    // Extract the key content (remove header and footer if present)
                    let keyContent = formattedPrivateKey;
                    if (keyContent.includes(header)) {
                        keyContent = keyContent
                            .replace(header, "")
                            .replace(footer, "")
                            .trim();
                    }
                    // Add line breaks every 64 characters
                    const chunks = [];
                    for (let i = 0; i < keyContent.length; i += 64) {
                        chunks.push(keyContent.slice(i, i + 64));
                    }
                    formattedPrivateKey = `${header}\n${chunks.join("\n")}\n${footer}`;
                }
                sshConfig.privateKey = formattedPrivateKey;
            }
            this.sshClient.connect(sshConfig);
        });
    }
    createLocalPortForward() {
        return new Promise((resolve, reject) => {
            this.localServer = net.createServer((localSocket) => {
                this.sshClient.forwardOut(localSocket.remoteAddress || "127.0.0.1", localSocket.remotePort || 0, this.config.remoteHost, this.config.remotePort, (err, sshStream) => {
                    if (err) {
                        logger.logError("SSH forwardOut failed", err);
                        localSocket.end();
                        return;
                    }
                    // Pipe the local socket to the SSH stream and vice versa
                    localSocket.pipe(sshStream);
                    sshStream.pipe(localSocket);
                    // Handle cleanup
                    localSocket.on("close", () => {
                        sshStream.end();
                    });
                    sshStream.on("close", () => {
                        localSocket.end();
                    });
                    // Handle errors
                    localSocket.on("error", (err) => {
                        logger.logError("Local socket error", err);
                        sshStream.end();
                    });
                    sshStream.on("error", (err) => {
                        logger.logError("SSH stream error", err);
                        localSocket.end();
                    });
                });
            });
            this.localServer.listen(this.config.localPort, "127.0.0.1", () => {
                logger.logMessage("Local server listening on port %d", this.config.localPort);
                resolve();
            });
            this.localServer.on("error", (err) => {
                logger.logError("Local server error", err);
                reject(err);
            });
        });
    }
    async closeTunnel() {
        return new Promise((resolve) => {
            if (this.localServer) {
                this.localServer.close();
                this.localServer = null;
            }
            if (this.sshClient) {
                this.sshClient.end();
                this.sshClient = null;
            }
            logger.logMessage("SSH tunnel closed");
            resolve();
        });
    }
    isConnected() {
        return this.sshClient !== null && this.localServer !== null;
    }
    getLocalPort() {
        return this.config.localPort;
    }
}
export { SSHTunnelManager };
//# sourceMappingURL=ssh-tunnel.mjs.map