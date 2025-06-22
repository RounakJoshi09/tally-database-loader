# SSH Tunnel Setup for Remote MySQL Connection

This guide explains how to configure SSH tunneling to connect to a remote MySQL server through an Ubuntu server.

## Overview

SSH tunneling creates a secure encrypted connection between your local machine and a remote MySQL server through an SSH server. This allows you to connect to MySQL databases that are not directly accessible from your network.

## Prerequisites

1. **Remote Ubuntu Server** with SSH access
2. **MySQL Server** running on the remote Ubuntu server
3. **SSH credentials** (username/password or private key)
4. **MySQL credentials** (username/password)
5. **Node.js** installed on your local machine

## Configuration

### Method 1: Using the Setup Script (Recommended)

1. Run the setup script:

   ```bash
   setup-remote-mysql.bat
   ```

2. Follow the prompts to enter:

   - Remote Ubuntu server IP address
   - SSH username and password
   - MySQL username and password
   - MySQL database name
   - Local tunnel port (default: 3307)

3. The script will create a `config-remote-mysql.json` file

4. Copy the configuration to `config.json`:
   ```bash
   copy config-remote-mysql.json config.json
   ```

### Method 2: Manual Configuration

Edit your `config.json` file to include SSH tunnel settings:

```json
{
  "database": {
    "technology": "mysql",
    "server": "localhost",
    "port": 3307,
    "ssl": false,
    "schema": "your_database_name",
    "username": "your_mysql_username",
    "password": "your_mysql_password",
    "loadmethod": "insert",
    "ssh_tunnel": {
      "enabled": true,
      "host": "192.168.1.100",
      "port": 22,
      "username": "ubuntu_user",
      "password": "ssh_password",
      "localPort": 3307,
      "remoteHost": "localhost",
      "remotePort": 3306
    }
  },
  "tally": {
    "definition": "tally-export-config.yaml",
    "server": "localhost",
    "port": 9000,
    "fromdate": "2024-04-01",
    "todate": "2025-03-31",
    "sync": "full",
    "frequency": 0,
    "company": ""
  }
}
```

## Configuration Parameters

### SSH Tunnel Settings

| Parameter    | Description                               | Default     |
| ------------ | ----------------------------------------- | ----------- |
| `enabled`    | Enable/disable SSH tunneling              | `false`     |
| `host`       | Remote Ubuntu server IP address           | -           |
| `port`       | SSH port (usually 22)                     | `22`        |
| `username`   | SSH username                              | -           |
| `password`   | SSH password                              | -           |
| `privateKey` | SSH private key (alternative to password) | -           |
| `localPort`  | Local port for tunnel                     | `3307`      |
| `remoteHost` | MySQL host on remote server               | `localhost` |
| `remotePort` | MySQL port on remote server               | `3306`      |

### Database Settings

| Parameter    | Description                                   | Default     |
| ------------ | --------------------------------------------- | ----------- |
| `technology` | Database type                                 | `mysql`     |
| `server`     | Database server (set to localhost for tunnel) | `localhost` |
| `port`       | Database port (set to localPort for tunnel)   | `3307`      |
| `schema`     | Database name                                 | -           |
| `username`   | MySQL username                                | -           |
| `password`   | MySQL password                                | -           |

## Testing the Connection

Before running the main application, test your SSH tunnel connection:

```bash
test-ssh-tunnel.bat
```

This will:

1. Establish SSH tunnel to your remote server
2. Test MySQL connection through the tunnel
3. Run a simple query to verify connectivity
4. Display troubleshooting tips if connection fails

## Running the Application

Once the SSH tunnel is configured and tested:

1. **One-time sync:**

   ```bash
   run.bat
   ```

2. **GUI interface:**

   ```bash
   run-gui.bat
   ```

3. **Command line:**
   ```bash
   node src/index.mjs
   ```

## Troubleshooting

### Common SSH Issues

1. **Connection refused:**

   - Verify SSH server is running on remote machine
   - Check SSH port (usually 22) is open
   - Ensure firewall allows SSH connections

2. **Authentication failed:**

   - Verify SSH username and password
   - Check if SSH key authentication is required
   - Ensure user has SSH access permissions

3. **Host key verification failed:**
   - Add remote host to known_hosts file
   - Use `ssh-keyscan` to pre-populate host keys

### Common MySQL Issues

1. **Access denied:**

   - Verify MySQL username and password
   - Check if MySQL user has access from localhost
   - Ensure MySQL is configured to accept local connections

2. **Database not found:**

   - Verify database name exists
   - Check MySQL user has access to the database

3. **Connection timeout:**
   - Check if MySQL is running on remote server
   - Verify MySQL port (3306) is correct
   - Ensure MySQL is configured to accept connections

### Network Issues

1. **Port already in use:**

   - Change `localPort` to an available port
   - Check if another application is using the port

2. **Firewall blocking:**
   - Ensure SSH port (22) is open on remote server
   - Check if local firewall blocks outbound SSH connections

## Security Considerations

1. **SSH Key Authentication:** For better security, use SSH key authentication instead of passwords
2. **Port Security:** Use non-standard ports for SSH when possible
3. **User Permissions:** Create dedicated SSH and MySQL users with minimal required permissions
4. **Network Security:** Ensure SSH and MySQL are not exposed to the public internet without proper security measures

## Advanced Configuration

### Using SSH Key Authentication

To use SSH key authentication instead of password:

1. Generate SSH key pair:

   ```bash
   ssh-keygen -t rsa -b 4096
   ```

2. Copy public key to remote server:

   ```bash
   ssh-copy-id username@remote-server-ip
   ```

3. Update configuration:
   ```json
   "ssh_tunnel": {
       "enabled": true,
       "host": "192.168.1.100",
       "port": 22,
       "username": "ubuntu_user",
       "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----",
       "localPort": 3307,
       "remoteHost": "localhost",
       "remotePort": 3306
   }
   ```

### Multiple Database Connections

You can configure multiple SSH tunnels for different databases by using different local ports:

```json
{
  "database": {
    "ssh_tunnel": {
      "localPort": 3307,
      "remotePort": 3306
    }
  }
}
```

For a second database:

```json
{
  "database": {
    "ssh_tunnel": {
      "localPort": 3308,
      "remotePort": 3306
    }
  }
}
```

## Support

If you encounter issues:

1. Check the application logs in `error-log.txt`
2. Run the test script to isolate connection issues
3. Verify SSH and MySQL configurations on the remote server
4. Check network connectivity and firewall settings
