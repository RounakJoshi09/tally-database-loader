import { SSHTunnelManager } from "./src/ssh-tunnel.mjs";
import mysql from "mysql2";

// SSH Tunnel Configuration
const sshConfig = {
  host: "128.199.27.171", // Replace with your Ubuntu server IP
  port: 22, // SSH port (usually 22)
  username: "root", // Replace with your SSH username
  privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCsXa/5LjAdRh8AeSwDGKB+lBw8oUovZwqpsDzcM56JmgAAAKAImCYfCJgm
HwAAAAtzc2gtZWQyNTUxOQAAACCsXa/5LjAdRh8AeSwDGKB+lBw8oUovZwqpsDzcM56Jmg
AAAEBxlL15mTrNU7Xxd3mtroChv2gWcLFUiJ4GPwxVvhnw9qxdr/kuMB1GHwB5LAMYoH6U
HDyhSi9nCqmwPNwznomaAAAAG0F6dXJlQUQrUm91bmFrSm9zaGlAUm91bmFrSgEC
-----END OPENSSH PRIVATE KEY-----
`, // Replace with your SSH private key
  localPort: 3307, // Local port for tunnel
  remoteHost: "127.0.0.1", // MySQL host on remote server
  remotePort: 3306, // MySQL port on remote server
};

// MySQL Configuration
const mysqlConfig = {
  host: "127.0.0.1",
  port: 3306,
  database: "tally",
  user: "root", // Replace with your MySQL username
  password: "EHg=2?<mPK&$hra.", // Replace with your MySQL password
};

async function testSSHTunnel() {
  let sshTunnel = null;
  let mysqlConnection = null;

  try {
    console.log("Testing SSH tunnel connection...");

    // Create SSH tunnel
    sshTunnel = new SSHTunnelManager(sshConfig);
    await sshTunnel.createTunnel();
    console.log("✓ SSH tunnel established successfully");

    // Test MySQL connection through tunnel
    console.log("Testing MySQL connection through SSH tunnel...");
    mysqlConnection = mysql.createConnection(mysqlConfig);

    await new Promise((resolve, reject) => {
      mysqlConnection.connect((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    console.log("✓ MySQL connection successful through SSH tunnel");

    // Test a simple query
    const [rows] = await mysqlConnection
      .promise()
      .query("SELECT VERSION() as version");
    console.log("✓ MySQL query successful:", rows[0].version);

    console.log("\n🎉 SSH tunnel and MySQL connection test passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.log("\nTroubleshooting tips:");
      console.log("1. Check if SSH server is running on the remote machine");
      console.log("2. Verify SSH credentials (username/password)");
      console.log("3. Ensure SSH port (22) is open and accessible");
      console.log("4. Check if MySQL is running on the remote server");
      console.log("5. Verify MySQL credentials and database name");
    }
  } finally {
    // Clean up connections
    if (mysqlConnection) {
      mysqlConnection.end();
    }
    if (sshTunnel) {
      await sshTunnel.closeTunnel();
    }
  }
}

// Run the test
testSSHTunnel().catch(console.error);
