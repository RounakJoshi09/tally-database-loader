# Tally to Database Server: Data Loader Utility
![logo](tally-database-loader.png)




Commandline utility to load data into Database Server from Tally software, intended for further use by
* MS Excel / Google Sheet (for tabular reports)
* Power BI / Google Data Studio (for dashboards)

## Index
* [Version](version)
* [Requirements](#requirements)
* [Download](#download)
    * Utility
    * Tally
    * Node JS
    * SQL Server
    * MySQL Server
    * MariaDB Server
* [Tally XML Server](#tally-xml-server)
    * Tally Prime
    * Tally.ERP 9
* [Database Creation](#database-creation)
* [Utility Installation](#utility-installation)
* [Configuration Setup](#configuration-setup)
    * Database Connection
    * Tally Options
* [Steps](#steps)
* [Commandline Options](#commandline-options)
* [Logs](#logs)
* [Develop Further](#develop-further)
* [License](#license)
* [Contact](#contact)
* [Frequently Asked Questions](#frequently-asked-questions)

<br><br>

## Version

Build: **1.0.0**

Updated: **26-Mar-2021**

<br><br>

## Requirements
Utility requires installation of following as a pre-requisite
* Windows 10
* Tally.ERP 9 / Tally Prime
* Node JS
* SQL Server / MySQL Server / MariaDB Server

<br><br>

## Download

### Utility
Database Loader Utility is portable, and does not have a setup wizard like we find for software installation. Zip archive of utility can be downloaded from below link

[Download Database Loader Utility](https://excelkida.com/resource/tally-database-loader-utility-1.0.0.zip)

Also, it is a commandline utility having no window interface (to keep it minimal and faster)

### Tally
Utility is currently compatible for both Tally.ERP 9 and Tally Prime. Future releases of utility will be tested and updated for Tally Prime only (as ERP 9 will not receive feature updates). Also, database structure of Utility will be updated aligned to Tally Prime.

[Download Tally Prime](https://tallysolutions.com/download/)

### Node JS
Node.JS is an open-source javascript compiler running on cross platform V8 engine (used by Google Chrome & Microsoft Edge browser). This utility require latest (or stable) version of Node.JS installed in system. It can be downloaded from official website of Node.JS

[Download Node.JS](https://nodejs.org/en/)

### SQL Server
Microsoft SQL Server is the prefered Database Server solution, when it comes to Windows OS.
Microsoft offers **Express (free)** version of SQL Server which can be used for personal use (with certain limitations on database size).

[Download Micrsoft SQL Server 2019 - Express Edition](https://www.microsoft.com/en-ie/sql-server/sql-server-downloads)

### MySQL Server
Oracle MySQL Server is an open-source Database Server compatible on both Windows and Linux OS. It has best performance in Linux-based Operating Systems.
Oracle offers **Community (free)** version of MySQL Server, which can be used for personal use.

[Download MySQL Server 8.x - Community Edition](https://dev.mysql.com/downloads/mysql/)


### MariaDB Server
MariaDB is a complete open-source Database Server available freely which is a drop-in replacement to MySQL Server, and is an emerging option among database community.

[Download Maria DB Server](https://mariadb.org/download/)

<br><br>

## Tally XML Server
Tally has in-built XML Server capability, which can import/export data in/out of Tally. This utility sends export command to Tally along with report specification written in TDL (Tally Developer Language) in XML format. In response, Tally returns back the requested data (in CSV format), which is then imported into Database Server. This utility works for both Tally.ERP 9 and Tally Prime both. Kindly ensure that XML Server of Tally is enabled (one-time). Avoid running Tally Prime & ERP.9 both at same time, as by default, both of them would try to block port numbert 9000 for XML Server. If you still need to run both simulteneously, change the port number of Tally Prime, or you can also disable XML Server of any of the Tally instance.

### Tally.ERP 9
* Gateway of Tally > Configure (F12) > Advanced Configuration
* Set Tally.ERP 9 is acting as **Both**

### Tally Prime
* Help (F1) > Settings > Connectivity
* Client/Server configuration
* Set TallyPrime is acting as **Both**

<br><br>



## Database Creation
Database first needs to be created and then Tables needs to be created in which data from Tally will be loaded, before running utility. File **database-structure.sql** contains SQL for creating tables of database. Just ensure to create database using any of GUI Database Manager. That database name should be updated in **schema** property of *config.json*. Open-source database editor available freely are
* [SQL Server: SQL Server Management Studio](https://docs.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms?view=sql-server-ver15)
* [MySQL Server: MySQL Workbench](https://dev.mysql.com/downloads/workbench/)

Utility support import into database server installed and hosted on
* Same PC where Tally is
* On any machine on LAN
* Virtual Private Server
* Cloud Database [ Microsoft Azure / Amazon Web Services (AWS) / Google Cloud Platform / Oracle Cloud ]

<br><br>

## Configuration Setup
Utility contains a file **config.json** containing database connection and tally related settings.

<br>

### Database Connection
Database Connection credentials needs to be set in the file in **database** section of *config.json*. A sample configuration file

**SQL Server**
```json
"database": {
    "technology": "mssql",
    "server": "DESKTOP-<computer_name>\SQLEXPRESS",
    "port": 1433,
    "schema": "<database_name>",
    "username": "sa",
    "password": "<your_password>",
    "loadmethod": "insert"
}
```
<br/>

**MySQL / MariaDB Server**
```json
"database": {
    "technology": "mysql",
    "server": "localhost",
    "port": 3306,
    "schema": "<dataname>",
    "username": "root",
    "password": "<your_password>",
    "loadmethod": "insert"
}
```

| Settings | Value |
| --- | --- |
| technology | **mssql**: Microsoft SQL Server<br>**mysql**: MySQL Server or MariaDB Server |
| server | Qualified computer name or Database Instance or IP Address of PC where Database Server is hosted |
| port | Port number on which Database Server is listening<br>**mssql**: Default port is **1433**<br>**mysql**: Default port is **3306** |
| schema | Database name in which to insert data |
| username | Username<br>**mssql**: Default user is **sa** <br>**mysql**: Default user is **root** |
| password | Password for corresponding user. It is set during installation of Database Server.<br>*Note: Trusted Login (password-less) of SQL Server not supported by this utility* |
| loadmethod | **insert**: loads rows in database tables using SQL query with multiple rows. This is most compatible method which works everywhere (Compatibility: **High** / Performance: **Slow** ) <br> **file**: loads rows in database table using file based loading method. This method works only when database server and utility is running on same machine. So this method is not compatible with Cloud databases (Compatibility: **Low** / Performance: **Fast** ) |

Kindly override configurations, as per respective Database Server setup

<br>

### Tally Options
Few of the options of Tally may need modification, if default settings of Tally are specifically over-ridden (due to port clashes). A sample configuration of tally is demonstrated as below

```json
"tally": {
     "server": "localhost",
     "port": 9000,
     "master": true,
     "transaction": true,
     "fromdate" : "20190401",
     "todate" : "20200331"
}
```

| Setting | Value |
| --- | --- |
| server | IP Address or Computer Name on which Tally XML Server is running (**localhost** is default value equivalent of IP Address 127.0.0.1). Change this if you need to capture data from a Tally running on different PC on your LAN |
| port | By default Tally runs XML Server on port number **9000**. Modify this if you have assigned different port number in Tally XML Server settings (typically done when you want run Tally.ERP 9 and Tally Prime both at a same time parallely, where you will be changing this port number) |
| master / transaction | **true** = Export master/transaction data from Tally (*default*) <br> **false** = Skip master/transaction data |
| fromdate / todate | **YYYYMMDD** = Period from/to for export of transaction and opening balance (in 8 digit format) <br> **auto** = This will export complete transactions (irrespective of selected Financial Year) from Tally by auto-detection of First & Last date of transaction |


<br><br>

## Steps
1. Create database in Database Server along with tables inside it (use **database-structure.sql** to create tables)  [ignore if already created]
1. Ensure options are properly set in **config.json**
1. Ensure Tally is running and target company from which to export data is Active
1. Run the file **run.bat**
1. Commandline window will open, attempt to import data and will get closed after import/error
1. Check for import status in **import-log.txt** file and errors (if any) in **error-log.txt** file

<br><br>

## Commandline Options
Utility is completely driven by configuration specified in **config.json** file. In case if specific configuration(s) needs to be overriden without changing it in config file, it can be done using commandline switches as follows:

```bat
node ./dist/index.js [[--option 01] [value 01] [--option 02] [value 02] ...]
```

**option**: Syntax for option is **--parent-child** , *parent* is the main config name followed by *child* is the sub-config name in **config.json** . (Refer example for further explanation)

**value**: Value of config for corresponsing option

### Examples:

**Scenario 01:** We have created separate databases for individual clients & currently need to load data of client in database named **airtel** in SQL Server, with rest of the settings unchanged, then below is the command for desired output
```bat
node ./dist/index.js --database-schema airtel
```

**Scenario 02:** We need to set from & to date dynamically (without changing config file), lets say **FY 2019-20 Q3**, then below is the command for that
```bat
node ./dist/index.js --tally-fromdate 20191001 --tally-todate 20191231
```

**Scenario 03:** You are using Amazon Web Services (AWS) as database server, and have multiple servers for each client group of companies with multiple separate database for each subsidiary company. You intend to sync data for **FY 2020-21** from Tally into **Jio** company database residing in **Reliance** server hosted at Mumbai region data centre of AWS. Command will be
```bat
node ./dist/index.js --tally-fromdate 20200401 --tally-todate 20210331 --database-server database-1.reliance.in-mumbai-1.rds.amazonaws.com --database-schema jio
```

<br><br>

## Logs
Utility creates log of import specifying how many rows in each tables were loaded. This log can be found in **import-log.txt** file. If any error occurs, then details of error(s) are logged in **error-log.txt** file

<br><br>

## Develop Further
If you intend to develop and modify this utility further to next level for your use-case, then you can clone this project from Git and run the project as below
1. Clone the project repository
1. Install Visual Studio and open the project repository folder
1. Install required npm packages by following command **npm install**
1. Install global instance of typescript compiler available on Node Package Manager by following command **npm install typescript -g**
1. Run the project in Visual Studio code (**launch.json** file already provided in **.vscode** folder to run it with required settings)

<br><br>

## License
This project is under MIT license. You are free to use this utility for commercial & educational purpose.

<br><br>

## Contact
Project developed & maintained by: **Dhananjay Gokhale**

For any query email to **dhananjay1405@gmail.com** or Whatsapp on **(+91) 90284-63366**

<br><br>

## Frequently Asked Question

**Ques:** I got an error **connect ECONNREFUSED 127.0.0.1:9000** in *error-log.txt* file. What is this error about ?

**Ans:** This error comes if Node.JS compiler is unable to communicate with Tally on that port. Possible resolutions
* Ensure that Tally is running
* Check if Tally XML Server is enabled
* Ensure if port number specified in *config.json* is actually configured in Tally XML Settings

**Ques:** I got an error **Cannot detect First/Last voucher date from company** in *error-log.txt* file. What is this error ?

**Ans:** This error is self-descriptive. Possible resolutions
* No company is selected (or active) in Tally
* Company has no voucher in it

**Ques:** I got an error **connect ECONNREFUSED 127.0.0.1:3306** in *error-log.txt* file. What is this error about ?

**Ans:** If utility is unable to connnect to database, this error will be generated