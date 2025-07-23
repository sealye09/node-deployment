## Deployment Script

This directory contains the scripts for deploying the application to `test` and `production` environments.

### Prerequisites

1.  **Node.js**: Node.js version 22 is required. Please use a version manager like `nvm` or `fnm` to ensure you are using the correct version.
2.  **Environment Files**: You need to create `.env.test.local` and `.env.production.local` files in the `deploy` directory. These files are not checked into version control.
3.  **SSH Access**: You must have passwordless SSH access (using SSH keys) to the target server.
4.  **Dependencies**: Run `npm install` in the project root to install the required deployment script dependencies (`dotenv`, `archiver`).

### Environment File Setup

Create the following files in the `/deploy` directory:

**`deploy/.env.test.local`**

```
SERVER=username@test-server-ip
REMOTE_DIR=/path/to/your/test/deployment
```

**`deploy/.env.production.local`**

```
SERVER=username@production-server-ip
REMOTE_DIR=/path/to/your/production/deployment
```

### Usage

The script is a Node.js script. You can run it from the project root directory.

#### Deploy to Test Environment

```bash
node deploy/deploy.js --mode=test
```

#### Deploy to Production Environment

```bash
node deploy/deploy.js --mode=production
```

### Deployment Logic

1.  **Mode Selection**: The script accepts a `--mode` flag which can be `test` or `production`. If not provided, it will exit.
2.  **Environment Check**: It checks if the correct Node.js version (v22) is being used and exits if not.
3.  **Build**: It runs the appropriate build command (`npm run build:test` or `npm run build:prod`).
4.  **Load Environment**: It loads the `SERVER` and `REMOTE_DIR` variables from the corresponding `.env` file (`deploy/.env.test.local` or `deploy/.env.production.local`).
5.  **Compress**: The build output from the `dist/` folder is compressed into a zip file in the system's temporary directory.
6.  **Upload**: The zip file is securely copied (`scp`) to the remote server's remote directory.
7.  **Remote Execution**: On the server, the script performs the following actions via SSH:
    - Creates the remote directory if it doesn't exist.
    - Cleans the directory of any old files.
    - Unzips the new application files.
    - Removes the uploaded zip file.
    - Sets the correct file permissions (`chmod -R 755 .`).
8.  **Cleanup**: The local zip file is deleted. 
